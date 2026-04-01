import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { ADMIN_PERMISSIONS, normalizeAdminPermissions } from '@/lib/server/admin-permissions';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';
import { getClientIp } from '@/lib/server/request-ip';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = schema.parse(body);
    const login = username.trim().toLowerCase();

    // Super admin fallback account (admin + WEB_ADMIN_PASSWORD).
    const adminPass = process.env.WEB_ADMIN_PASSWORD?.trim();
    if (login === 'admin' && adminPass && password === adminPass) {
      const session = await getSession();
      session.userId = 'admin';
      session.username = 'admin';
      session.isAdmin = true;
      session.adminPermissions = [...ADMIN_PERMISSIONS];
      await session.save();
      return NextResponse.json({ ok: true, userId: 'admin' });
    }

    const u = (await db.findUserByWebLogin(login)) || (await db.findUser(`web_${login}`)) || null;
    if (!u || !u.passwordHash) {
      return NextResponse.json({ error: 'Sai tài khoản hoặc mật khẩu' }, { status: 401 });
    }
    if (isUserBanned(u)) {
      return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
    }
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Sai tài khoản hoặc mật khẩu' }, { status: 401 });
    }
    const perms = normalizeAdminPermissions(u.adminPermissions);
    if (!perms.length) {
      return NextResponse.json({ error: 'Tài khoản chưa được cấp quyền admin' }, { status: 403 });
    }

    const session = await getSession();
    session.userId = u.id;
    session.username = u.username || u.webLogin || login;
    session.isAdmin = true;
    session.adminPermissions = perms;
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
