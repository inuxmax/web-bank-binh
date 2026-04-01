import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import {
  ADMIN_PERMISSION_LABELS,
  ADMIN_PERMISSIONS,
  getSessionAdminPermissions,
  hasAdminPermission,
  normalizeAdminPermissions,
} from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

async function canManagePermissions() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return { ok: false as const };
  if (session.userId === 'admin') return { ok: true as const, session };
  const perms = await getSessionAdminPermissions(session);
  if (!hasAdminPermission(perms, 'permissions')) return { ok: false as const };
  return { ok: true as const, session };
}

export async function GET() {
  const auth = await canManagePermissions();
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await db.getAllUsers();
  const items = users
    .filter((u) => String(u.id) !== 'admin')
    .map((u) => ({
      id: u.id,
      name: u.fullName || u.username || u.webLogin || u.id,
      webLogin: u.webLogin || '',
      isActive: !!u.isActive,
      adminPermissions: normalizeAdminPermissions(u.adminPermissions),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return NextResponse.json({
    permissions: ADMIN_PERMISSIONS.map((id) => ({ id, label: ADMIN_PERMISSION_LABELS[id] })),
    items,
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  adminPermissions: z.array(z.string()).max(64),
});

export async function PATCH(req: Request) {
  const auth = await canManagePermissions();
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const { userId, adminPermissions } = patchSchema.parse(body);
    if (userId === 'admin') {
      return NextResponse.json({ error: 'Không chỉnh quyền tài khoản admin hệ thống' }, { status: 400 });
    }
    const u = await db.findUser(userId);
    if (!u) return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
    const normalized = normalizeAdminPermissions(adminPermissions);
    await db.updateUser(userId, { adminPermissions: normalized });
    return NextResponse.json({ ok: true, adminPermissions: normalized });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

