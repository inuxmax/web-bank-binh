import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { restoreMongoBackupFromProject } from '@/lib/server/mongo-backup';

export const runtime = 'nodejs';

const bodySchema = z.object({
  fileName: z.string().min(1),
});

async function assertAllowed() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return false;
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'settings')) return false;
  }
  return true;
}

export async function POST(req: Request) {
  if (!(await assertAllowed())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const data = bodySchema.parse(body);
    const result = await restoreMongoBackupFromProject(data.fileName);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Thiếu tên file backup' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Restore failed' }, { status: 500 });
  }
}
