import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import * as db from '@/lib/server/db';
import { getSession } from '@/lib/get-session';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';
import { getClientIp } from '@/lib/server/request-ip';
import { normalizeAdminPermissions } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = schema.parse(body);
    const webLogin = username.trim().toLowerCase();
    const u =
      (await db.findUserByWebLogin(webLogin)) ||
      (await db.findUser(`web_${webLogin}`)) ||
      null;

    if (!u || !u.passwordHash) {
      return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });
    }

    if (isUserBanned(u)) {
      return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
    }

    const session = await getSession();
    const adminPermissions = normalizeAdminPermissions(u.adminPermissions);
    session.userId = u.id;
    session.username = u.username || u.webLogin || webLogin;
    session.isAdmin = adminPermissions.length > 0;
    session.adminPermissions = adminPermissions;
    await session.save();
    await db.updateUser(u.id, {
      lastLoginIp: getClientIp(req),
      lastLoginAt: Date.now(),
    });

    return NextResponse.json({ ok: true, userId: u.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
