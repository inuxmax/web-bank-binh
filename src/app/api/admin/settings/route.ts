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
    if (!hasAdminPermission(perms, 'settings')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  const config = await db.getConfig();
  return NextResponse.json({ config });
}

const patchSchema = z.object({
  globalFeePercent: z.number().min(0).max(100),
  ctvCommissionPercent: z.number().min(0).max(100),
  ipnFeeFlat: z.number().min(0),
  withdrawFeeFlat: z.number().min(0),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'settings')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const config = await db.updateConfig({
      globalFeePercent: data.globalFeePercent,
      ctvCommissionPercent: data.ctvCommissionPercent,
      ipnFeeFlat: data.ipnFeeFlat,
      withdrawFeeFlat: data.withdrawFeeFlat,
    });
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Không thể lưu cấu hình' }, { status: 500 });
  }
}

