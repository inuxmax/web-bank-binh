import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { buildWithdrawDoneText, notifyUserTelegramByUserId } from '@/lib/server/notify';

export const runtime = 'nodejs';

function fmtVnd(n: unknown) {
  const x = Number(n) || 0;
  return `${x.toLocaleString('vi-VN')}đ`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'withdrawals')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const limit = Math.min(1000, Math.max(1, Number(searchParams.get('limit')) || 500));
  const [items, users] = await Promise.all([db.getWithdrawals({ status, limit }), db.getAllUsers()]);
  const userMap = new Map(users.map((u) => [String(u.id), u]));
  return NextResponse.json({
    items: items.map((it) => {
      const uid = String((it as { userId?: string }).userId || '');
      const u = userMap.get(uid);
      return {
        ...it,
        username: String((it as { username?: string }).username || u?.username || u?.webLogin || ''),
        isVerified: u?.isVerified === true,
        isScam: u?.isScam === true,
      };
    }),
  });
}

const updateSchema = z.object({
  id: z.string().optional(),
  mongoId: z.string().optional(),
  action: z.enum(['done', 'reject_wrong', 'reject', 'reject_with_reason']),
  rejectNote: z.string().max(500).optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'withdrawals')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { id, mongoId, action, rejectNote } = updateSchema.parse(body);
    const idNorm = String(id || '').trim();
    const mongoNorm = String(mongoId || '').trim();
    if (!idNorm && !mongoNorm) {
      return NextResponse.json({ error: 'Thiếu id hoặc mongoId' }, { status: 400 });
    }
    let w =
      (idNorm ? await db.getWithdrawalById(idNorm) : null) ||
      (idNorm ? await db.getWithdrawalById(`WD${idNorm}`) : null) ||
      (idNorm ? await db.getWithdrawalById(String(idNorm).replace(/^WD/i, '')) : null);
    if (!w && mongoNorm) {
      w = await db.getWithdrawalByMongoId(mongoNorm);
    }
    if (!w) {
      return NextResponse.json({ error: 'Không tìm thấy lệnh rút' }, { status: 404 });
    }
    const wid = String(w.id || '');
    const wm = String(w.mongoId || mongoNorm || '');

    if (action === 'done') {
      if (String(w.status) !== 'done') {
        if (wid) await db.updateWithdrawalStatus(wid, 'done');
        else if (wm) await db.updateWithdrawalStatusByMongoId(wm, 'done');
        const userId = String(w.userId || '');
        if (userId) {
          await db.addUserBalanceHistory({
            ts: Date.now(),
            userId,
            delta: 0,
            balanceAfter: Number((await db.getUser(userId)).balance) || 0,
            reason: 'withdraw_done',
            ref: wid || wm,
          });
          const msg = [
            buildWithdrawDoneText({
              amount: Number(w.amount) || 0,
              feeFlat: Number(w.feeFlat) || 0,
              actualReceive: Number(w.actualReceive) || 0,
            }),
          ].join('\n');
          await notifyUserTelegramByUserId(userId, msg);
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'reject_wrong' || action === 'reject') {
      if (String(w.status) !== 'reject') {
        const userId = String(w.userId || '');
        if (userId) {
          const amt = Number(w.amount) || 0;
          const u = await db.getUser(userId);
          const after = u.balance + amt;
          await db.updateUser(userId, { balance: after });
          await db.addUserBalanceHistory({
            ts: Date.now(),
            userId,
            delta: amt,
            balanceAfter: after,
            reason: 'withdraw_refund',
            ref: wid || wm,
          });
          await db.addUserBalanceHistory({
            ts: Date.now(),
            userId,
            delta: 0,
            balanceAfter: after,
            reason: action === 'reject_wrong' ? 'withdraw_reject_wrong' : 'withdraw_reject',
            ref: wid || wm,
          });
          const rejectLabel = action === 'reject_wrong' ? 'Sai thông tin tài khoản' : 'Admin từ chối';
          const msg = [
            '❌ Lệnh rút tiền bị từ chối',
            `Mã: ${wid || wm || '—'}`,
            `Lý do: ${rejectLabel}`,
            `Số tiền hoàn: ${fmtVnd(amt)}`,
            `Số dư sau hoàn: ${fmtVnd(after)}`,
          ].join('\n');
          await notifyUserTelegramByUserId(userId, msg);
        }
        if (wid) {
          await db.updateWithdrawalStatus(wid, 'reject', {
            rejectReason: action === 'reject_wrong' ? 'wrong_info' : 'admin_reject',
          });
        } else if (wm) {
          await db.updateWithdrawalStatusByMongoId(wm, 'reject', {
            rejectReason: action === 'reject_wrong' ? 'wrong_info' : 'admin_reject',
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'reject_with_reason') {
      const note = String(rejectNote || '').trim();
      if (!note) {
        return NextResponse.json({ error: 'Cần rejectNote' }, { status: 400 });
      }
      if (String(w.status) !== 'reject') {
        const userId = String(w.userId || '');
        if (userId) {
          const amt = Number(w.amount) || 0;
          const u = await db.getUser(userId);
          const after = u.balance + amt;
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
            reason: `withdraw_reject_note:${note}`,
            ref: wid || wm,
          });
          const msg = [
            '❌ Lệnh rút tiền bị từ chối',
            `Mã: ${wid || wm || '—'}`,
            `Lý do: ${note}`,
            `Số tiền hoàn: ${fmtVnd(amt)}`,
            `Số dư sau hoàn: ${fmtVnd(after)}`,
          ].join('\n');
          await notifyUserTelegramByUserId(userId, msg);
        }
        if (wid) {
          await db.updateWithdrawalStatus(wid, 'reject', {
            rejectReason: 'admin_reject',
            rejectNote: note,
          });
        } else if (wm) {
          await db.updateWithdrawalStatusByMongoId(wm, 'reject', {
            rejectReason: 'admin_reject',
            rejectNote: note,
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
