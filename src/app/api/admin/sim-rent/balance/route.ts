import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const BASE_URL = 'https://bossotp.net';

export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'settings')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const cfg = await db.getConfig();
  const token = String(cfg.simRentApiToken || '').trim();
  const markupPercent = Number(cfg.simRentMarkupPercent || 0) || 0;
  if (!token) {
    return NextResponse.json({ balance: 0, markupPercent, configured: false });
  }

  const url = `${BASE_URL}/api/v4/users/me/balance?api_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  const balance = Number((data as { balance?: number }).balance || 0) || 0;
  return NextResponse.json({ balance, markupPercent, configured: true });
}
