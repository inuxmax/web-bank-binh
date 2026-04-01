import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';

export const runtime = 'nodejs';

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

  rows = rows.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)).slice(0, limit);
  return NextResponse.json({ items: rows });
}
