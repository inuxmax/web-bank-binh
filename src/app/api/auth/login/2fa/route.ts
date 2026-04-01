import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import * as db from '@/lib/server/db';
import { getSession } from '@/lib/get-session';
import { getClientIp } from '@/lib/server/request-ip';
import { normalizeAdminPermissions } from '@/lib/server/admin-permissions';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  code: z.string().min(4).max(10),
});

function hash2fa(userId: string, code: string) {
  return crypto
    .createHash('sha256')
    .update(`${String(userId).toLowerCase()}|${String(code).trim()}`, 'utf8')
    .digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, code } = schema.parse(body);
    const webLogin = username.trim().toLowerCase();
    const u =
      (await db.findUserByWebLogin(webLogin)) ||
      (await db.findUser(`web_${webLogin}`)) ||
      null;
    if (!u || !u.passwordHash) {
      return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });
    }
    const okPass = await bcrypt.compare(password, u.passwordHash);
    if (!okPass) {
      return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 });
    }
    if (isUserBanned(u)) {
      return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
    }
    if (u.twoFactorEnabled !== true) {
      return NextResponse.json({ error: 'Tài khoản chưa bật 2FA.' }, { status: 400 });
    }
    const exp = Number(u.twoFactorCodeExpires || 0);
    if (!exp || Date.now() > exp) {
      return NextResponse.json({ error: 'Mã 2FA đã hết hạn. Vui lòng đăng nhập lại để nhận mã mới.' }, { status: 400 });
    }
    const hash = hash2fa(u.id, code);
    if (hash !== String(u.twoFactorCodeHash || '')) {
      return NextResponse.json({ error: 'Mã 2FA không đúng.' }, { status: 400 });
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
      twoFactorCodeHash: '',
      twoFactorCodeExpires: null,
    });
    return NextResponse.json({ ok: true, userId: u.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
