import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { notifyAdminsTelegram } from '@/lib/server/notify';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId || session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const me = await db.getUser(session.userId);
    const status = me.ctvStatus || 'none';
    if (status === 'approved') {
      return NextResponse.json({ ok: true, status: 'approved' });
    }
    if (status === 'pending') {
      return NextResponse.json({ ok: true, status: 'pending' });
    }
    await db.updateUser(me.id, {
      ctvStatus: 'pending',
      ctvAppliedAt: Date.now(),
    });
    await notifyAdminsTelegram(
      [
        '🆕 USER ĐĂNG KÝ CTV',
        `User: ${me.fullName || me.username || me.webLogin || me.id}`,
        `User ID: ${me.id}`,
        `Login: ${me.webLogin || '—'}`,
      ].join('\n'),
    );
    return NextResponse.json(
      { ok: true, status: 'pending' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Không thể đăng ký CTV' }, { status: 500 });
  }
}

