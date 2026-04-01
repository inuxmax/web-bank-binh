import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  if (session.isAdmin && String(session.userId || '') === 'admin') {
    return NextResponse.json({
      user: {
        id: 'admin',
        username: 'admin',
        isAdmin: true,
        isActive: true,
        balance: 0,
      },
    });
  }

  const fresh = await db.getUser(session.userId);
  const adminPermissions = await getSessionAdminPermissions(session);

  return NextResponse.json({
    user: {
      id: fresh.id,
      username: fresh.username || fresh.webLogin,
      fullName: fresh.fullName || '',
      isActive: fresh.isActive,
      isBanned: fresh.isBanned === true,
      telegramLinked: !!fresh.telegramId,
      isAdmin: adminPermissions.length > 0,
      adminPermissions,
      balance: fresh.balance,
      vaLimit: fresh.vaLimit,
      createdVA: fresh.createdVA,
      ctvStatus: fresh.ctvStatus || 'none',
      ctvCode: fresh.ctvCode || '',
      phone: fresh.phone || '',
    },
  });
}
