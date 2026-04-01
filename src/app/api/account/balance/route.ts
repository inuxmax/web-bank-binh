import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { getAccountBalance, hpaySignatureHint } from '@/lib/server/hpay';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'balance')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const { decoded, raw } = await getAccountBalance({});

    let historyNote = '';
    try {
      const balNum = decoded && (decoded.balance ?? decoded.availableBalance);
      const rawStr = balNum != null ? String(balNum) : '';
      if (rawStr !== '') {
        await db.addBalanceHistory({
          balance: Number(String(rawStr).replace(/[^\d.-]/g, '')) || 0,
          balanceRaw: rawStr,
          source: 'api',
          adminId: 'admin',
        });
        historyNote = 'logged';
      }
    } catch {
      /* ignore */
    }

    return NextResponse.json({ decoded, raw, historyNote, hint: hpaySignatureHint(raw) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
