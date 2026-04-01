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
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return { fromTs: start, toTs: end };
    }
  }
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  } else if (preset === 'month') {
    start.setDate(1);
  } else if (preset === 'year') {
    start.setMonth(0, 1);
  }
  return { fromTs: start.getTime(), toTs: end.getTime() };
}

function inRange(ts: unknown, fromTs: number, toTs: number) {
  const n = Number(ts) || 0;
  return n >= fromTs && n <= toTs;
}

function num(v: unknown) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'admin_home')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      preset: url.searchParams.get('preset') || 'day',
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
    });
    const { fromTs, toTs } = getRange(parsed.preset, parsed.from, parsed.to);

    const [va, wd, users] = await Promise.all([db.loadAll(), db.loadWithdrawals(), db.getAllUsers()]);

    const primaryVa = va.filter((r) => !String((r as { parentRequestId?: string }).parentRequestId || '').trim());
    const totalVaCreated = primaryVa.filter((r) => inRange((r as { createdAt?: number }).createdAt, fromTs, toTs)).length;

    const totalTransactionAmount = va
      .filter((r) => String((r as { status?: string }).status || '') === 'paid')
      .filter((r) => inRange((r as { timePaid?: number; createdAt?: number }).timePaid || (r as { createdAt?: number }).createdAt, fromTs, toTs))
      .reduce((sum, r) => sum + num((r as { amount?: number }).amount), 0);

    const totalIbftAmount = wd
      .filter((w) => String((w as { status?: string }).status || '') === 'done')
      .filter((w) => inRange((w as { updatedAt?: number; createdAt?: number }).updatedAt || (w as { createdAt?: number }).createdAt, fromTs, toTs))
      .reduce((sum, w) => {
        const actual = num((w as { actualReceive?: number }).actualReceive);
        const amount = num((w as { amount?: number }).amount);
        return sum + (actual > 0 ? actual : amount);
      }, 0);

    const totalUsers = users.filter((u) => inRange(u.registerAt, fromTs, toTs)).length;
    const totalCtv = users.filter((u) => String(u.ctvStatus || '') === 'approved' && inRange(u.ctvApprovedAt, fromTs, toTs)).length;

    return NextResponse.json({
      ok: true,
      range: { fromTs, toTs, preset: parsed.preset, from: parsed.from || '', to: parsed.to || '' },
      totals: { totalVaCreated, totalTransactionAmount, totalIbftAmount, totalUsers, totalCtv },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Query không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Không thể lấy thống kê' }, { status: 500 });
  }
}
