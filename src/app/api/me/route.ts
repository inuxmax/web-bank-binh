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
  const cfg = await db.getConfig();
  const adminPermissions = await getSessionAdminPermissions(session);
  const globalFeePercent = Number((cfg as { globalFeePercent?: number }).globalFeePercent ?? 0) || 0;
  const globalIpnFeeFlat = Number((cfg as { ipnFeeFlat?: number }).ipnFeeFlat ?? 0) || 0;
  const globalWithdrawFeeFlat = Number((cfg as { withdrawFeeFlat?: number }).withdrawFeeFlat ?? 0) || 0;
  const userFeePercent =
    fresh.feePercent !== null && fresh.feePercent !== undefined ? Number(fresh.feePercent) : NaN;
  const feePercent = Number.isFinite(userFeePercent) && userFeePercent > 0 ? userFeePercent : globalFeePercent;
  const ipnFeeFlat =
    fresh.ipnFeeFlat !== null && fresh.ipnFeeFlat !== undefined
      ? Number(fresh.ipnFeeFlat) || 0
      : globalIpnFeeFlat;
  const withdrawFeeFlat =
    fresh.withdrawFeeFlat !== null && fresh.withdrawFeeFlat !== undefined
      ? Number(fresh.withdrawFeeFlat) || 0
      : globalWithdrawFeeFlat;

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
      feePercent,
      ipnFeeFlat,
      withdrawFeeFlat,
    },
  });
}
