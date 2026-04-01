import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';
import { createVirtualAccountForOwner } from '@/lib/server/user-actions';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().min(2).max(50),
  bankCode: z.string().max(10).optional(),
  remark: z.string().max(50).optional(),
  assignUserId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const actor = await db.getUser(session.userId);
    if (!session.isAdmin && isUserBanned(actor)) {
      return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
    }
    if (!session.isAdmin && !actor.isActive) {
      return NextResponse.json({ error: 'Tài khoản chưa được duyệt' }, { status: 403 });
    }

    const body = await req.json();
    const { name, bankCode: rawBank, remark: remarkInput, assignUserId } = schema.parse(body);
    if (assignUserId && !session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const ownerId =
      session.isAdmin && assignUserId && assignUserId.trim() ? assignUserId.trim() : session.userId!;

    const result = await createVirtualAccountForOwner(ownerId, name, {
      bankCode: rawBank,
      remark: remarkInput,
      isAdminContext: session.isAdmin,
    });

    if (!result.ok) {
      const st = result.status ?? 400;
      if (st === 422) {
        return NextResponse.json(
          { error: result.error, code: result.code, hint: result.hint },
          { status: 422 },
        );
      }
      return NextResponse.json({ error: result.error }, { status: st });
    }

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      decoded: result.decoded,
      raw: result.raw,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
