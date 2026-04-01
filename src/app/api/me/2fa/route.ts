import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

const schema = z.object({
  enabled: z.boolean(),
  currentPassword: z.string().min(1),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { enabled, currentPassword } = schema.parse(body);
    const u = await db.findUser(session.userId);
    if (!u || !u.passwordHash) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });
    }
    const ok = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    if (enabled && !String(u.email || '').trim()) {
      return NextResponse.json({ error: 'Cần có email để bật 2FA.' }, { status: 400 });
    }
    await db.updateUser(u.id, {
      twoFactorEnabled: enabled,
      twoFactorCodeHash: '',
      twoFactorCodeExpires: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
