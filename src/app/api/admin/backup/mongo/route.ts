import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { cleanupMongoBackups, createMongoBackupToProject, listMongoBackupFiles } from '@/lib/server/mongo-backup';

export const runtime = 'nodejs';

async function assertAllowed() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return false;
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'settings')) {
      return false;
    }
  }
  return true;
}

export async function GET() {
  if (!(await assertAllowed())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const [files, config] = await Promise.all([listMongoBackupFiles(), db.getConfig()]);
    return NextResponse.json({
      ok: true,
      files,
      auto: {
        enabled: Boolean((config as { mongoBackupAutoEnabled?: boolean }).mongoBackupAutoEnabled),
        intervalMinutes: Number((config as { mongoBackupIntervalMinutes?: number }).mongoBackupIntervalMinutes || 360),
        keepFiles: Number((config as { mongoBackupKeepFiles?: number }).mongoBackupKeepFiles || 20),
        lastRunAt: Number((config as { mongoBackupLastRunAt?: number }).mongoBackupLastRunAt || 0),
      },
    });
  } catch (e) {
    console.error('[admin backup mongo][GET]', e);
    return NextResponse.json({ error: (e as Error).message || 'Cannot load backup list' }, { status: 500 });
  }
}

export async function POST() {
  if (!(await assertAllowed())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const [result, config] = await Promise.all([createMongoBackupToProject(), db.getConfig()]);
    const keepFiles = Number((config as { mongoBackupKeepFiles?: number }).mongoBackupKeepFiles || 20);
    await cleanupMongoBackups(keepFiles);
    await db.updateConfig({ mongoBackupLastRunAt: Date.now() });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[admin backup mongo][POST]', e);
    return NextResponse.json({ error: (e as Error).message || 'Backup failed' }, { status: 500 });
  }
}
