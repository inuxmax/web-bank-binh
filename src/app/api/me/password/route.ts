import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { currentPassword, newPassword } = schema.parse(body);
    const u = await db.findUser(session.userId);
    if (!u || !u.passwordHash) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 });
    }
    const ok = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
    const nextHash = await bcrypt.hash(newPassword, 10);
    await db.updateUser(u.id, { passwordHash: nextHash });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
