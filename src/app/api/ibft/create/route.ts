import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getIbftBankLabel } from '@/lib/banks';
import { createIBFT, hpaySignatureHint } from '@/lib/server/hpay';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const schema = z.object({
  bankCode: z.string().min(2).max(15),
  accountNumber: z.string().min(6).max(24),
  accountName: z.string().min(2).max(80),
  amount: z.union([z.string(), z.number()]),
  remark: z.string().max(200).optional(),
  sourceBank: z.enum(['MSB', 'KLB']).optional(),
});

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
    /** Sinpay IBFT thường cần tên NH (label), không chỉ mã KLB/VCB… */
    const bankName = (getIbftBankLabel(code) || code).trim();
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
      accountName: parsed.accountName.trim(),
      amount: parsed.amount,
      remark: parsed.remark,
      callbackUrl: String(process.env.IBFT_CALLBACK_URL || '').trim() || undefined,
      ...ov,
    });

    await db.addIbftHistory({
      adminId: session.userId,
      bankCode: parsed.bankCode,
      accountNumber: parsed.accountNumber,
      accountName: parsed.accountName,
      amount: Number(parsed.amount),
      remark: parsed.remark,
      orderId: decoded && String((decoded as Record<string, unknown>).orderId || ''),
      tranStatus: decoded && String((decoded as Record<string, unknown>).tranStatus || ''),
      errorCode: String(raw.errorCode || ''),
      errorMessage: String(raw.errorMessage || ''),
    });

    const hint = hpaySignatureHint(raw);
    const bizHint =
      String(raw.errorCode || '') === '214404'
        ? '214404 (sandbox): thường là từ chối nghiệp vụ — kiểm tra tên NH đích (đã gửi bankName), STK/tên chủ khớp test Sinpay, số tiền min/max sandbox, merchant đã bật IBFT/KLB; nếu chi KLB cần bộ client/MID KLB (HPAY_*_KLB) khớp kênh nguồn.'
        : undefined;

    return NextResponse.json({ decoded, raw, requestId, hint: hint || bizHint, debug });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ', details: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
