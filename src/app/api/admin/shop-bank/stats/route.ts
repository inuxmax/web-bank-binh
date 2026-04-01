import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const querySchema = z.object({
  preset: z.enum(['day', 'week', 'month', 'year', 'custom']).default('day'),
  from: z.string().optional(),
  to: z.string().optional(),
});

function parseYmdToStart(v: string) {
  const d = new Date(`${v}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}
function parseYmdToEnd(v: string) {
  const d = new Date(`${v}T23:59:59.999`);
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}
function getRange(preset: 'day' | 'week' | 'month' | 'year' | 'custom', from?: string, to?: string) {
  const now = new Date();
  if (preset === 'custom' && from && to) {
    const start = parseYmdToStart(from);
    const end = parseYmdToEnd(to);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return { fromTs: start, toTs: end };
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === 'week') {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  } else if (preset === 'month') {
    start.setDate(1);
  } else if (preset === 'year') {
    start.setMonth(0, 1);
  }
  return { fromTs: start.getTime(), toTs: end.getTime() };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'shop_bank')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const q = querySchema.parse({
      preset: url.searchParams.get('preset') || 'day',
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
    });
    const { fromTs, toTs } = getRange(q.preset, q.from, q.to);
    const [totals, banks] = await Promise.all([
      db.getShopBankRevenue(fromTs, toTs),
      db.getShopBankInventoryByBank(),
    ]);
    return NextResponse.json({
      fromTs,
      toTs,
      totals,
      banks,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Query không hợp lệ' }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message || 'Lỗi hệ thống' }, { status: 500 });
  }
}
