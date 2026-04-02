import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const querySchema = z.object({
  fileName: z.string().min(1),
});

const BACKUP_FILE_NAME_RE = /^mongo-backup-\d{8}-\d{6}\.json$/i;

async function assertAllowed() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return false;
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'settings')) return false;
  }
  return true;
}

export async function GET(req: Request) {
  if (!(await assertAllowed())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse({
      fileName: searchParams.get('fileName') || '',
    });
    const fileName = String(parsed.fileName).trim();
    if (!BACKUP_FILE_NAME_RE.test(fileName)) {
      return NextResponse.json({ error: 'Tên file không hợp lệ' }, { status: 400 });
    }

    const [{ readFile }, pathMod] = await Promise.all([import('fs/promises'), import('path')]);
    const path = pathMod.default || pathMod;
    const filePath = path.join(process.cwd(), 'backups', 'mongo', fileName);
    const content = await readFile(filePath, 'utf8');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Thiếu tên file' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Không thể tải file backup' }, { status: 500 });
  }
}
