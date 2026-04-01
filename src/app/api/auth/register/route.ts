import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import * as db from '@/lib/server/db';
import { getSession } from '@/lib/get-session';
import { getClientIp } from '@/lib/server/request-ip';
import { notifyAdminsTelegram } from '@/lib/server/notify';

export const runtime = 'nodejs';

const schema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(80),
  phone: z.string().min(8).max(20),
  email: z.string().email().max(120),
  referralCode: z.string().max(32).optional(),
  agreedTerms: z.literal(true),
});

function normalizePhone(raw: string) {
  return String(raw || '').replace(/[^\d+]/g, '').trim();
}

function makeRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'CTV';
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUniqueReferralCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = makeRandomCode();
    const exists = await db.findUserByCtvCode(code);
    if (!exists) return code;
  }
  return `CTV${Date.now().toString(36).toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, fullName, phone, email, referralCode } = schema.parse(body);
    const webLogin = username.trim().toLowerCase();
    const id = `web_${webLogin}`;
    const now = Date.now();
    const clientIp = getClientIp(req);
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cfg = await db.getConfig();
    const autoApproveNewUsers = Boolean((cfg as { autoApproveNewUsers?: boolean }).autoApproveNewUsers);
    const defaultReferralCode = String(process.env.DEFAULT_CTV_CODE || '').trim().toUpperCase();
    const normalizedReferral = String(referralCode || '').trim().toUpperCase();
    const effectiveReferralCode = normalizedReferral || defaultReferralCode || '';

    if ((await db.findUser(id)) || (await db.findUserByWebLogin(webLogin))) {
      return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 400 });
    }
    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
    }
    if (await db.findUserByEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Email đã tồn tại' }, { status: 400 });
    }
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Số điện thoại không hợp lệ' }, { status: 400 });
    }
    if (!effectiveReferralCode) {
      return NextResponse.json({ error: 'Thiếu mã CTV (và chưa cấu hình mã mặc định)' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ownerCode = await generateUniqueReferralCode();
    let referredByUserId = '';
    if (effectiveReferralCode) {
      const owner = await db.findUserByCtvCode(effectiveReferralCode);
      if (!owner && normalizedReferral && normalizedReferral !== defaultReferralCode) {
        return NextResponse.json({ error: 'Mã CTV không tồn tại' }, { status: 400 });
      }
      if (owner && owner.id !== id) referredByUserId = owner.id;
    }
    await db.updateUser(id, {
      webLogin,
      passwordHash,
      username: username.trim(),
      fullName: fullName.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      isActive: autoApproveNewUsers,
      registerIp: clientIp,
      registerAt: now,
      lastLoginIp: clientIp,
      lastLoginAt: now,
      ctvCode: ownerCode,
      referredByCode: effectiveReferralCode || undefined,
      referredByUserId: referredByUserId || undefined,
    });

    const session = await getSession();
    session.userId = id;
    session.username = username.trim();
    session.isAdmin = false;
    await session.save();

    await notifyAdminsTelegram(
      [
        '🆕 USER ĐĂNG KÝ MỚI',
        `User: ${username.trim()}`,
        `User ID: ${id}`,
        `SĐT: ${normalizedPhone}`,
        `Email: ${normalizedEmail}`,
        `Kích hoạt tự động: ${autoApproveNewUsers ? 'ON (đã active)' : 'OFF (chờ duyệt)'}`,
        `IP: ${clientIp || '—'}`,
        `Thời gian: ${new Date(now).toLocaleString('vi-VN')}`,
      ].join('\n'),
    );

    return NextResponse.json({ ok: true, userId: id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ', details: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
