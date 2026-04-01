import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email().max(120),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

function hashResetCode(email: string, code: string) {
  const secret = String(process.env.SESSION_SECRET || 'sinpay').trim();
  return crypto.createHash('sha256').update(`${email}|${code}|${secret}`, 'utf8').digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = schema.parse(body);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await db.findUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json({ error: 'Email hoặc mã xác nhận không đúng' }, { status: 400 });
    }
    const now = Date.now();
    const codeExpires = Number(user.resetCodeExpires || 0) || 0;
    const codeHash = String(user.resetCodeHash || '').trim();
    if (!codeHash || codeExpires <= now) {
      return NextResponse.json({ error: 'Mã xác nhận đã hết hạn hoặc không hợp lệ' }, { status: 400 });
    }
    const expected = hashResetCode(normalizedEmail, code);
    if (expected !== codeHash) {
      return NextResponse.json({ error: 'Email hoặc mã xác nhận không đúng' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.updateUser(user.id, {
      passwordHash,
      resetCodeHash: '',
      resetCodeExpires: 0,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Không thể đặt lại mật khẩu' }, { status: 500 });
  }
}
