import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { createVirtualAccountForOwner } from '@/lib/server/user-actions';
import { randomName } from '@/lib/names';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const schema = z.object({
  quantity: z.number().int().min(1).max(100),
  bankCode: z.enum(['MSB', 'KLB', 'BIDV', '']).optional(),
  randomNames: z.boolean().optional(),
  baseName: z.string().max(50).optional(),
  names: z.array(z.string().min(1).max(50)).max(100).optional(),
});

function buildName(randomNames: boolean, baseName: string, index: number): string {
  if (randomNames) return randomName();
  const safeBase = String(baseName || '').trim();
  if (!safeBase) return randomName();
  if (index === 0) return safeBase.slice(0, 50);
  return `${safeBase} ${index + 1}`.slice(0, 50);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'va_bulk')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const quantity = Number(data.quantity) || 1;
    const randomNames = data.randomNames !== false;
    const baseName = String(data.baseName || '').trim();
    const bankCode = String(data.bankCode || '').trim().toUpperCase();
    const names =
      Array.isArray(data.names) && data.names.length
        ? data.names.map((n) => String(n || '').trim()).filter(Boolean)
        : [];

    const items: Record<string, unknown>[] = [];
    let success = 0;
    let failed = 0;
    for (let i = 0; i < quantity; i += 1) {
      const name = names[i] || buildName(randomNames, baseName, i);
      const result = await createVirtualAccountForOwner(session.userId, name, {
        bankCode: bankCode || undefined,
        isAdminContext: true,
      });
      if (!result.ok) {
        failed += 1;
        items.push({
          index: i + 1,
          inputName: name,
          ok: false,
          error: result.error,
        });
        continue;
      }
      success += 1;
      items.push({
        index: i + 1,
        inputName: name,
        ok: true,
        requestId: result.requestId,
        vaAccount: String(result.decoded?.vaAccount || ''),
        vaBank: String(result.decoded?.vaBank || ''),
        vaName: String(result.decoded?.vaName || ''),
        vaAmount: String(result.decoded?.vaAmount || ''),
        quickLink: String(result.decoded?.quickLink || ''),
        remark: String(result.decoded?.remark || ''),
      });
    }

    return NextResponse.json({
      ok: true,
      success,
      failed,
      total: quantity,
      items,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

