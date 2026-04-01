import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

export async function POST() {
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

  const statsResetAt = Date.now();
  const config = await db.updateConfig({ statsResetAt });
  return NextResponse.json({ ok: true, statsResetAt: Number(config.statsResetAt || statsResetAt) });
}
