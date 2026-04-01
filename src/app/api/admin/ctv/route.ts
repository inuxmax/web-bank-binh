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
    if (!hasAdminPermission(perms, 'ctv')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  const users = await db.getAllUsers();
  const cfg = await db.getConfig();
  const cfgRate = Number((cfg as { ctvCommissionPercent?: number }).ctvCommissionPercent);
  const statusUsers = users.filter((u) => {
    const s = String(u.ctvStatus || 'none');
    return s === 'pending' || s === 'approved' || s === 'rejected';
  });

  const rows = statusUsers.map((u) => {
    const referralCount = users.filter((x) => String(x.referredByUserId || '') === u.id).length;
    return {
      id: u.id,
      name: u.fullName || u.username || u.webLogin || '—',
      webLogin: u.webLogin || '',
      ctvStatus: u.ctvStatus || 'none',
      ctvCode: u.ctvCode || '',
      referralCount,
      commissionTotal: Number(u.ctvCommissionTotal || 0),
      commissionCount: Number(u.ctvCommissionCount || 0),
      userRatePercent: u.ctvRatePercent == null ? null : Number(u.ctvRatePercent),
      customerFeePercent: u.ctvCustomerFeePercent == null ? null : Number(u.ctvCustomerFeePercent),
      ratePercent: Number(
        u.ctvRatePercent ??
          (Number.isFinite(cfgRate) ? cfgRate : undefined) ??
          process.env.CTV_COMMISSION_PERCENT ??
          1,
      ),
      ctvAppliedAt: Number(u.ctvAppliedAt || 0),
      ctvApprovedAt: Number(u.ctvApprovedAt || 0),
    };
  });

  return NextResponse.json({ items: rows });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject', 'set_rate', 'set_customer_fee']),
  ratePercent: z.number().min(0).max(100).nullable().optional(),
  customerFeePercent: z.number().min(0).max(100).nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'ctv')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  try {
    const body = await req.json();
    const { id, action, ratePercent, customerFeePercent } = patchSchema.parse(body);
    const user = await db.findUser(id);
    const cfg = await db.getConfig();
    const cfgRate = Number((cfg as { ctvCommissionPercent?: number }).ctvCommissionPercent);
    if (!user) return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });

    if (action === 'approve') {
      await db.updateUser(id, {
        ctvStatus: 'approved',
        ctvApprovedAt: Date.now(),
        ctvRatePercent:
          ratePercent !== undefined
            ? ratePercent
            : Number(
                user.ctvRatePercent ??
                  (Number.isFinite(cfgRate) ? cfgRate : undefined) ??
                  process.env.CTV_COMMISSION_PERCENT ??
                  1,
              ),
      });
      const fresh = await db.getUser(id);
      const ctvCustomerFee =
        fresh.ctvCustomerFeePercent !== null && fresh.ctvCustomerFeePercent !== undefined
          ? Number(fresh.ctvCustomerFeePercent)
          : NaN;
      if (Number.isFinite(ctvCustomerFee) && ctvCustomerFee >= 0) {
        const users = await db.getAllUsers();
        for (const x of users) {
          if (String(x.referredByUserId || '') !== id) continue;
          await db.updateUser(x.id, { feePercent: ctvCustomerFee });
        }
      }
    } else if (action === 'reject') {
      await db.updateUser(id, {
        ctvStatus: 'rejected',
      });
    } else if (action === 'set_rate') {
      await db.updateUser(id, {
        ctvRatePercent: ratePercent ?? null,
      });
    } else {
      await db.updateUser(id, {
        ctvCustomerFeePercent: customerFeePercent ?? null,
      });
      const users = await db.getAllUsers();
      for (const x of users) {
        if (String(x.referredByUserId || '') !== id) continue;
        await db.updateUser(x.id, { feePercent: customerFeePercent ?? null });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

