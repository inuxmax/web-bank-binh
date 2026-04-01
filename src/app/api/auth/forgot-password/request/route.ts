import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import * as db from '@/lib/server/db';
import { sendSmtpMail } from '@/lib/server/smtp';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email().max(120),
});

function hashResetCode(email: string, code: string) {
  const secret = String(process.env.SESSION_SECRET || 'sinpay').trim();
  return crypto.createHash('sha256').update(`${email}|${code}|${secret}`, 'utf8').digest('hex');
}

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await db.findUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: true });
    }

    const code = makeCode();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await db.updateUser(user.id, {
      resetCodeHash: hashResetCode(normalizedEmail, code),
      resetCodeExpires: expiresAt,
    });

    const text = [
      'Mã xác nhận khôi phục mật khẩu Sinpay của bạn:',
      '',
      `${code}`,
      '',
      'Mã có hiệu lực trong 10 phút.',
      'Nếu bạn không yêu cầu, vui lòng bỏ qua email này.',
    ].join('\n');
    await sendSmtpMail({
      to: normalizedEmail,
      subject: 'Khôi phục mật khẩu Sinpay',
      text,
      html: `<p>Mã xác nhận khôi phục mật khẩu Sinpay của bạn:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px">${code}</p><p>Mã có hiệu lực trong 10 phút.</p><p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Không thể gửi mã' }, { status: 500 });
  }
}
