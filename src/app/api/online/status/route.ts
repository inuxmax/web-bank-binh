import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const mongoBackupPollEnabled =
      String(process.env.MONGO_BACKUP_POLLER_ENABLED || 'true').trim().toLowerCase() !== 'false';
    if (mongoBackupPollEnabled) {
      const { startMongoBackupPoller } = await import('@/lib/server/mongo-backup-poller');
      startMongoBackupPoller();
    }
    await db.updateUser(session.userId, { webLastSeenAt: Date.now() });
    const onlineUsers = await db.countOnlineUsers(ONLINE_WINDOW_MS);
    return NextResponse.json({ ok: true, onlineUsers, windowMs: ONLINE_WINDOW_MS });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Không thể lấy số user online' }, { status: 500 });
  }
}
