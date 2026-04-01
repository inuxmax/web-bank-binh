import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';

export const runtime = 'nodejs';

function toMoney(v: unknown) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));
  const filterUser = searchParams.get('userId');

  if (!session.isAdmin) {
    const u = await db.getUser(session.userId);
    if (isUserBanned(u)) {
      return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
    }
  }

  let rows = await db.loadAll();
  if (session.isAdmin) {
    if (filterUser) rows = rows.filter((r) => String(r.userId) === filterUser);
  } else {
    rows = rows.filter((r) => String(r.userId) === String(session.userId));
  }

  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const vaAccount = String(r.vaAccount || '').trim();
    const key = vaAccount || `req:${String(r.requestId || '')}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const merged: Record<string, unknown>[] = Array.from(grouped.values()).map((group) => {
    const byTimeAsc = group
      .slice()
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
    const byTimeDesc = group
      .slice()
      .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    const base = byTimeAsc[0] || {};
    const latest = byTimeDesc[0] || {};

    const paidRows = group.filter((r) => String(r.status || '').trim().toLowerCase() === 'paid');
    const paidCount = paidRows.length;
    const totalGross = paidRows.reduce((sum, r) => sum + toMoney(r.amount ?? r.vaAmount), 0);
    const totalNet = paidRows.reduce((sum, r) => sum + toMoney(r.netAmount ?? r.amount ?? r.vaAmount), 0);
    const latestPaid =
      paidRows
        .slice()
        .sort(
          (a, b) =>
            (Number(b.timePaid) || Number(b.createdAt) || 0) -
            (Number(a.timePaid) || Number(a.createdAt) || 0),
        )[0] || null;

    if (!latestPaid) {
      return {
        ...base,
        ...latest,
        status: String(latest.status || base.status || 'unpaid'),
        paidCount: 0,
      } as Record<string, unknown>;
    }

    return {
      ...base,
      ...latest,
      status: 'paid',
      amount: String(totalGross),
      netAmount: String(totalNet),
      timePaid: latestPaid.timePaid ?? latestPaid.createdAt ?? base.timePaid ?? base.createdAt,
      transferContent: latestPaid.transferContent || latestPaid.remark || base.transferContent || base.remark || '',
      transactionId: latestPaid.transactionId || '',
      cashinId: latestPaid.cashinId || '',
      paidCount,
    } as Record<string, unknown>;
  });

  const items = merged
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, limit);

  return NextResponse.json({ items });
}
