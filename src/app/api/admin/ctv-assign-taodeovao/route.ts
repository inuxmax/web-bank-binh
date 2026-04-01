import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

function isAllowedOperator(userId: string | undefined) {
  const uid = String(userId || '').trim().toLowerCase();
  return uid === 'web_taodeovao' || uid === 'taodeovao';
}

async function resolveTargetCtv(targetUserId?: string) {
  const raw = String(targetUserId || '').trim();
  if (raw) {
    return (await db.findUser(raw)) || (await db.findUserByWebLogin(raw.toLowerCase()));
  }
  return (
    (await db.findUserByWebLogin('taodeovao')) ||
    (await db.findUser('web_taodeovao')) ||
    (await db.findUser('taodeovao'))
  );
}

async function guardAdmin() {
  const session = await getSession();
  if (!session.userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const isOperator = isAllowedOperator(session.userId);
  if (!session.isAdmin && !isOperator) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: Request) {
  const g = await guardAdmin();
  if ('error' in g) return g.error;

  const url = new URL(req.url);
  const targetFromQuery = String(url.searchParams.get('targetUserId') || '').trim();
  const target = await resolveTargetCtv(targetFromQuery);
  if (!target) {
    return NextResponse.json({ error: 'Không tìm thấy user CTV đích' }, { status: 404 });
  }

  const users = await db.getAllUsers();
  const items = users
    .filter((u) => String(u.id) !== String(target.id))
    .map((u) => ({
      id: u.id,
      name: u.fullName || u.username || u.webLogin || '—',
      webLogin: u.webLogin || '',
      balance: Number(u.balance || 0),
      isActive: Boolean(u.isActive),
      isBanned: Boolean(u.isBanned),
      referredByUserId: String(u.referredByUserId || ''),
      isAssignedToTarget: String(u.referredByUserId || '') === String(target.id),
    }))
    .sort((a, b) => {
      if (a.isAssignedToTarget !== b.isAssignedToTarget) return a.isAssignedToTarget ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });

  return NextResponse.json({
    target: {
      id: target.id,
      webLogin: target.webLogin || 'taodeovao',
      name: target.fullName || target.username || target.webLogin || 'taodeovao',
      ctvCode: target.ctvCode || '',
      ctvStatus: target.ctvStatus || 'none',
      customerFeePercent:
        target.ctvCustomerFeePercent !== null && target.ctvCustomerFeePercent !== undefined
          ? Number(target.ctvCustomerFeePercent)
          : null,
    },
    items,
  });
}

const patchSchema = z.object({
  userId: z.string().min(1).optional(),
  userIds: z.array(z.string().min(1)).max(5000).optional(),
  targetUserId: z.string().min(1).optional(),
  action: z.enum(['assign', 'unassign', 'assign_many', 'unassign_many']),
});

export async function PATCH(req: Request) {
  const g = await guardAdmin();
  if ('error' in g) return g.error;

  try {
    const body = await req.json();
    const { userId, userIds, targetUserId, action } = patchSchema.parse(body);
    const target = await resolveTargetCtv(targetUserId);
    if (!target) {
      return NextResponse.json({ error: 'Không tìm thấy user CTV đích' }, { status: 404 });
    }
    const normalizeIds = (arr: string[]) =>
      [...new Set(arr.map((x) => String(x || '').trim()).filter(Boolean))]
        .filter((x) => x !== String(target.id));

    if (action === 'assign_many' || action === 'unassign_many') {
      const ids = normalizeIds(Array.isArray(userIds) ? userIds : []);
      if (!ids.length) {
        return NextResponse.json({ error: 'Thiếu danh sách user' }, { status: 400 });
      }
      let updated = 0;
      for (const id of ids) {
        const u = await db.findUser(id);
        if (!u) continue;
        if (action === 'assign_many') {
          const patch: Record<string, unknown> = {
            referredByUserId: target.id,
            referredByCode: target.ctvCode || undefined,
          };
          const customerFee =
            target.ctvCustomerFeePercent !== null && target.ctvCustomerFeePercent !== undefined
              ? Number(target.ctvCustomerFeePercent)
              : NaN;
          if (Number.isFinite(customerFee) && customerFee >= 0) {
            patch.feePercent = customerFee;
          }
          await db.updateUser(u.id, patch);
          updated += 1;
        } else if (String(u.referredByUserId || '') === String(target.id)) {
          await db.updateUser(u.id, {
            referredByUserId: '',
            referredByCode: '',
          });
          updated += 1;
        }
      }
      return NextResponse.json({ ok: true, updated });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Thiếu userId' }, { status: 400 });
    }
    if (String(userId) === String(target.id)) {
      return NextResponse.json({ error: 'Không thể tự gán chính CTV này' }, { status: 400 });
    }
    const u = await db.findUser(userId);
    if (!u) return NextResponse.json({ error: 'Không tìm thấy user' }, { status: 404 });

    if (action === 'assign') {
      const patch: Record<string, unknown> = {
        referredByUserId: target.id,
        referredByCode: target.ctvCode || undefined,
      };
      const customerFee =
        target.ctvCustomerFeePercent !== null && target.ctvCustomerFeePercent !== undefined
          ? Number(target.ctvCustomerFeePercent)
          : NaN;
      if (Number.isFinite(customerFee) && customerFee >= 0) {
        patch.feePercent = customerFee;
      }
      await db.updateUser(u.id, patch);
      return NextResponse.json({ ok: true });
    }

    if (String(u.referredByUserId || '') === String(target.id)) {
      await db.updateUser(u.id, {
        referredByUserId: '',
        referredByCode: '',
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
