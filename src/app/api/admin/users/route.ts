import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const users = (await db.getAllUsers()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username || u.webLogin,
      fullName: u.fullName || '',
      webLogin: u.webLogin,
      phone: u.phone || '',
      email: u.email || '',
      isActive: u.isActive,
      isBanned: u.isBanned === true,
      isVerified: u.isVerified === true,
      isScam: u.isScam === true,
      balance: u.balance,
      vaLimit: u.vaLimit,
      createdVA: u.createdVA,
      registerIp: u.registerIp || '',
      registerAt: u.registerAt || 0,
      lastLoginIp: u.lastLoginIp || '',
      lastLoginAt: u.lastLoginAt || 0,
      ctvStatus: u.ctvStatus || 'none',
      ctvCode: u.ctvCode || '',
      referredByCode: u.referredByCode || '',
      referredByUserId: u.referredByUserId || '',
      telegramLinked: Boolean(u.telegramId),
      telegramUsername: u.telegramUsername || '',
      feePercent: u.feePercent,
      ipnFeeFlat: u.ipnFeeFlat,
      withdrawFeeFlat: u.withdrawFeeFlat,
    })),
  });
}

const patchSchema = z.object({
  id: z.string().min(1).optional(),
  activeAll: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  isScam: z.boolean().optional(),
  vaLimit: z.number().int().min(0).nullable().optional(),
  feePercent: z.number().min(0).max(100).nullable().optional(),
  ipnFeeFlat: z.number().min(0).nullable().optional(),
  withdrawFeeFlat: z.number().min(0).nullable().optional(),
  /** Cộng tiền nội bộ cho user (admin); ghi vào lịch sử số dư */
  addBalance: z.number().int().positive().max(1_000_000_000).optional(),
  balanceNote: z.string().max(200).optional().nullable(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    if (data.activeAll === true) {
      const list = await db.getAllUsers();
      let updated = 0;
      for (const u of list) {
        if (String(u.id) === 'admin') continue;
        if (u.isBanned === true) continue;
        if (u.isActive) continue;
        await db.updateUser(u.id, { isActive: true });
        updated += 1;
      }
      return NextResponse.json({ ok: true, updated });
    }

    if (data.addBalance !== undefined) {
      if (!data.id) {
        return NextResponse.json({ error: 'Cần id user khi cộng tiền' }, { status: 400 });
      }
      const u = await db.findUser(data.id);
      if (!u) {
        return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
      }
      const prev = Number(u.balance) || 0;
      const add = data.addBalance;
      const next = prev + add;
      await db.updateUser(data.id, { balance: next });
      await db.addUserBalanceHistory({
        userId: String(data.id),
        delta: add,
        balanceAfter: next,
        reason: (data.balanceNote && String(data.balanceNote).trim()) || 'Admin cộng tiền',
        ref: `admin:${session.userId}`,
      });
    }

    const userPatch: Record<string, unknown> = {};
    if (data.isActive !== undefined) userPatch.isActive = data.isActive;
    if (data.isBanned !== undefined) userPatch.isBanned = data.isBanned;
    if (data.isVerified !== undefined) userPatch.isVerified = data.isVerified;
    if (data.isScam !== undefined) userPatch.isScam = data.isScam;
    if (data.vaLimit !== undefined) userPatch.vaLimit = data.vaLimit;
    if (data.feePercent !== undefined) userPatch.feePercent = data.feePercent;
    if (data.ipnFeeFlat !== undefined) userPatch.ipnFeeFlat = data.ipnFeeFlat;
    if (data.withdrawFeeFlat !== undefined) userPatch.withdrawFeeFlat = data.withdrawFeeFlat;

    if (data.id && Object.keys(userPatch).length > 0) {
      const existing = await db.findUser(data.id);
      if (!existing) {
        return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });
      }
      if (data.isBanned === true && String(data.id) === 'admin') {
        return NextResponse.json({ error: 'Không thể khóa tài khoản admin hệ thống' }, { status: 400 });
      }
      await db.updateUser(data.id, userPatch);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
