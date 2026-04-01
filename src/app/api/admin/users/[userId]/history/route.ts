import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { userId } = await ctx.params;
  const uid = String(userId || '').trim();
  if (!uid) {
    return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });
  }

  const u = await db.findUser(uid);
  if (!u) {
    return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
  }

  const vas = await db.getVAsByUser(uid, 500);
  const vaByRequestId = new Map<string, Record<string, unknown>>();
  const vaByParentRequestId = new Map<string, Record<string, unknown>>();
  const vaByTxId = new Map<string, Record<string, unknown>>();
  const vaByCashinId = new Map<string, Record<string, unknown>>();
  for (const r of vas as Record<string, unknown>[]) {
    const rid = String(r.requestId || '').trim();
    const parentRid = String(r.parentRequestId || '').trim();
    const txId = String(r.transactionId || '').trim();
    const cashinId = String(r.cashinId || '').trim();
    if (rid) vaByRequestId.set(rid, r);
    if (parentRid) vaByParentRequestId.set(parentRid, r);
    if (txId) vaByTxId.set(txId, r);
    if (cashinId) vaByCashinId.set(cashinId, r);
  }
  const vaItems = vas.map((r) => ({
    requestId: r.requestId != null ? String(r.requestId) : '',
    vaAccount: r.vaAccount != null ? String(r.vaAccount) : '',
    vaBank: r.vaBank != null ? String(r.vaBank) : '',
    name: r.name != null ? String(r.name) : '',
    status: r.status != null ? String(r.status) : '',
    remark: r.remark != null ? String(r.remark) : '',
    createdAt: Number(r.createdAt) || 0,
  }));

  const allWd = await db.loadWithdrawals();
  const withdrawals = allWd
    .filter((w) => String(w.userId) === uid)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, 200)
    .map((w) => ({
      id: String(w.id ?? ''),
      amount: Number(w.amount) || 0,
      status: w.status != null ? String(w.status) : '',
      bankName: w.bankName != null ? String(w.bankName) : '',
      bankAccount: w.bankAccount != null ? String(w.bankAccount) : '',
      bankHolder: w.bankHolder != null ? String(w.bankHolder) : '',
      actualReceive: Number(w.actualReceive) || 0,
      createdAt: Number(w.createdAt) || 0,
      updatedAt: Number(w.updatedAt) || 0,
    }));

  const transactions = (await db.getUserBalanceHistory(uid, 300)).map((x) => ({
    ...(() => {
      const reason = x.reason != null ? String(x.reason) : '';
      const reasonLower = reason.toLowerCase();
      const ref = x.ref != null ? String(x.ref) : '';
      let vaInfo: Record<string, unknown> | null = null;
      if (reasonLower === 'ipn' || reasonLower === 'va_paid') {
        const refKey = ref.trim();
        const baseRef = refKey.includes(':') ? refKey.split(':')[0] || refKey : refKey;
        const txRef = refKey.includes(':') ? refKey.split(':')[1] || '' : '';
        vaInfo =
          vaByRequestId.get(refKey) ||
          vaByRequestId.get(baseRef) ||
          vaByParentRequestId.get(baseRef) ||
          (txRef ? vaByTxId.get(txRef) : null) ||
          (txRef ? vaByCashinId.get(txRef) : null) ||
          vaByTxId.get(refKey) ||
          vaByCashinId.get(refKey) ||
          null;
      }
      return {
        vaAccount: vaInfo ? String(vaInfo.vaAccount || '') : '',
        vaBank: vaInfo ? String(vaInfo.vaBank || '') : '',
        transferContent: vaInfo
          ? String(vaInfo.transferContent || vaInfo.remark || '')
          : '',
      };
    })(),
    ts: Number(x.ts) || 0,
    delta: Number(x.delta) || 0,
    balanceAfter: Number(x.balanceAfter) || 0,
    reason: x.reason != null ? String(x.reason) : '',
    ref: x.ref != null ? String(x.ref) : '',
  }));

  return NextResponse.json({
    userId: uid,
    createdVACount: Number(u.createdVA) || 0,
    vaRecords: vaItems,
    withdrawals,
    transactions,
  });
}
