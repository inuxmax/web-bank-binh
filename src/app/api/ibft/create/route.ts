import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getIbftBankLabel } from '@/lib/banks';
import { createIBFT, hpaySignatureHint } from '@/lib/server/hpay';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { buildWithdrawDoneText, notifyUserTelegramByUserId } from '@/lib/server/notify';

export const runtime = 'nodejs';

const schema = z.object({
  bankCode: z.string().min(2).max(15),
  accountNumber: z.string().min(6).max(24),
  accountName: z.string().min(2).max(80),
  amount: z.union([z.string(), z.number()]),
  remark: z.string().max(200).optional(),
  sourceBank: z.enum(['MSB', 'KLB']).optional(),
  withdrawalId: z.string().optional(),
  withdrawalMongoId: z.string().optional(),
});

async function autoHandleLinkedWithdrawal(params: {
  id?: string;
  mongoId?: string;
  isSuccess: boolean;
  failureReason?: string;
}) {
  const idNorm = String(params.id || '').trim();
  const mongoNorm = String(params.mongoId || '').trim();
  if (!idNorm && !mongoNorm) return { updated: false, reason: 'missing_withdrawal_ref' as const, status: 'none' as const };

  let w =
    (idNorm ? await db.getWithdrawalById(idNorm) : null) ||
    (idNorm ? await db.getWithdrawalById(`WD${idNorm}`) : null) ||
    (idNorm ? await db.getWithdrawalById(String(idNorm).replace(/^WD/i, '')) : null);
  if (!w && mongoNorm) w = await db.getWithdrawalByMongoId(mongoNorm);
  if (!w) return { updated: false, reason: 'withdrawal_not_found' as const, status: 'none' as const };
  if (String(w.status || '') === 'done') return { updated: false, reason: 'already_done' as const, status: 'done' as const };
  if (String(w.status || '') === 'reject') return { updated: false, reason: 'already_reject' as const, status: 'reject' as const };

  const wid = String(w.id || '');
  const wm = String(w.mongoId || mongoNorm || '');
  const userId = String(w.userId || '');
  if (params.isSuccess) {
    if (wid) await db.updateWithdrawalStatus(wid, 'done');
    else if (wm) await db.updateWithdrawalStatusByMongoId(wm, 'done');
    if (userId) {
      await db.addUserBalanceHistory({
        ts: Date.now(),
        userId,
        delta: 0,
        balanceAfter: Number((await db.getUser(userId)).balance) || 0,
        reason: 'withdraw_done',
        ref: wid || wm,
      });
      const msg = buildWithdrawDoneText({
        amount: Number(w.amount || 0),
        feeFlat: Number(w.feeFlat || 0),
        actualReceive: Number(w.actualReceive || 0),
      });
      await notifyUserTelegramByUserId(userId, msg);
    }
    return { updated: true, reason: 'updated_done' as const, id: wid || wm, status: 'done' as const };
  }

  const rejectNote = String(params.failureReason || '').trim() || 'Số tài khoản hoặc tên ngân hàng không đúng.';
  if (wid) {
    await db.updateWithdrawalStatus(wid, 'reject', {
      rejectReason: 'admin_reject',
      rejectNote,
    });
  } else if (wm) {
    await db.updateWithdrawalStatusByMongoId(wm, 'reject', {
      rejectReason: 'admin_reject',
      rejectNote,
    });
  }
  if (userId) {
    const amt = Number(w.amount) || 0;
    const u = await db.getUser(userId);
    const after = (Number(u.balance) || 0) + amt;
    await db.updateUser(userId, { balance: after });
    await db.addUserBalanceHistory({
      ts: Date.now(),
      userId,
      delta: amt,
      balanceAfter: after,
      reason: 'withdraw_refund_reason',
      ref: wid || wm,
    });
    await db.addUserBalanceHistory({
      ts: Date.now(),
      userId,
      delta: 0,
      balanceAfter: after,
      reason: `withdraw_reject_note:${rejectNote}`,
      ref: wid || wm,
    });
    const msg = [
      '❌ Lệnh rút tiền bị từ chối',
      `Mã: ${wid || wm || '—'}`,
      `Lý do: ${rejectNote}`,
      `Số tiền hoàn: ${amt.toLocaleString('vi-VN')}đ`,
      `Số dư sau hoàn: ${after.toLocaleString('vi-VN')}đ`,
    ].join('\n');
    await notifyUserTelegramByUserId(userId, msg);
  }
  return { updated: true, reason: 'updated_reject' as const, id: wid || wm, status: 'reject' as const };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'ibft')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);
    const code = parsed.bankCode.trim().toUpperCase();
    const bankLabel = (getIbftBankLabel(code) || code).trim();
    // Sinpay IBFT thường ổn định hơn khi gửi mã NH đích (VCB/TCB/...) thay vì tên hiển thị.
    const bankName = code;
    const accountNameNormalized = parsed.accountName
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, 100);
    const ov =
      parsed.sourceBank === 'MSB'
        ? {
            xApiMidOverride: (process.env.HPAY_X_API_MID_MSB || process.env.HPAY_MERCHANT_ID_MSB || '').trim() || undefined,
            merchantIdOverride: (process.env.HPAY_MERCHANT_ID_MSB || '').trim() || undefined,
            passcodeOverride: (process.env.HPAY_PASSCODE_MSB || '').trim() || undefined,
            clientIdOverride: (process.env.HPAY_CLIENT_ID_MSB || '').trim() || undefined,
            clientSecretOverride: (process.env.HPAY_CLIENT_SECRET_MSB || '').trim() || undefined,
          }
        : parsed.sourceBank === 'KLB'
          ? {
              xApiMidOverride: (process.env.HPAY_X_API_MID_KLB || process.env.HPAY_MERCHANT_ID_KLB || '').trim() || undefined,
              merchantIdOverride: (process.env.HPAY_MERCHANT_ID_KLB || '').trim() || undefined,
              passcodeOverride: (process.env.HPAY_PASSCODE_KLB || '').trim() || undefined,
              clientIdOverride: (process.env.HPAY_CLIENT_ID_KLB || '').trim() || undefined,
              clientSecretOverride: (process.env.HPAY_CLIENT_SECRET_KLB || '').trim() || undefined,
            }
          : {};

    const { decoded, raw, requestId, debug } = await createIBFT({
      bankCode: code,
      bankName,
      accountNumber: parsed.accountNumber.replace(/\D/g, '').slice(0, 24),
      accountName: accountNameNormalized,
      amount: parsed.amount,
      remark: parsed.remark,
      callbackUrl: String(process.env.IBFT_CALLBACK_URL || '').trim() || undefined,
      ...ov,
    });

    await db.addIbftHistory({
      adminId: session.userId,
      bankCode: parsed.bankCode,
      accountNumber: parsed.accountNumber,
      accountName: accountNameNormalized || parsed.accountName,
      amount: Number(parsed.amount),
      remark: parsed.remark,
      orderId: decoded && String((decoded as Record<string, unknown>).orderId || ''),
      tranStatus: decoded && String((decoded as Record<string, unknown>).tranStatus || ''),
      errorCode: String(raw.errorCode || ''),
      errorMessage: String(raw.errorMessage || ''),
    });

    const hint = hpaySignatureHint(raw);
    const rawCode = String(raw.errorCode || '').trim();
    const rawMsg = String(raw.errorMessage || '').trim();
    const tranStatus = String((decoded as Record<string, unknown> | null)?.tranStatus || '')
      .trim()
      .toLowerCase();
    const ibftSuccess =
      rawCode === '00' ||
      (rawCode === '' && !rawMsg) ||
      tranStatus === 'success' ||
      tranStatus === 'done' ||
      tranStatus === 'completed';
    const autoHandled = await autoHandleLinkedWithdrawal({
      id: parsed.withdrawalId,
      mongoId: parsed.withdrawalMongoId,
      isSuccess: ibftSuccess,
      failureReason: rawMsg
        ? `Số tài khoản hoặc tên ngân hàng không đúng. (${rawMsg})`
        : 'Số tài khoản hoặc tên ngân hàng không đúng.',
    });
    const bizHint =
      String(raw.errorCode || '') === '214404'
        ? '214404: thường là từ chối nghiệp vụ — kiểm tra tên NH đích (đã gửi bankName), STK/tên chủ tài khoản, số tiền min/max theo chính sách, merchant đã bật IBFT/KLB; nếu chi KLB cần bộ client/MID KLB (HPAY_*_KLB) khớp kênh nguồn.'
        : undefined;

    return NextResponse.json({
      decoded,
      raw,
      requestId,
      autoHandled,
      hint: hint || bizHint,
      debug: {
        ...debug,
        normalized: {
          bankCode: code,
          bankLabel,
          bankNameSent: bankName,
          accountNameSent: accountNameNormalized,
        },
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ', details: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
