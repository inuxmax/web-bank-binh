import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { listVirtualAccounts, revokeVirtualAccount } from '@/lib/server/hpay';

export const runtime = 'nodejs';

async function assertAllowed() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return { ok: false as const };
  if (session.userId === 'admin') return { ok: true as const };
  const perms = await getSessionAdminPermissions(session);
  if (!hasAdminPermission(perms, 'va_manage')) return { ok: false as const };
  return { ok: true as const };
}

function normalizeVaItems(decoded: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!decoded) return [];
  const candidateKeys = ['items', 'list', 'rows', 'vaList', 'data'];
  for (const k of candidateKeys) {
    const v = decoded[k];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>;
      for (const nested of ['items', 'list', 'rows', 'vaList']) {
        if (Array.isArray(obj[nested])) return obj[nested] as Record<string, unknown>[];
      }
    }
  }
  return [];
}

const deleteSchema = z.object({
  vaAccounts: z.array(z.string().min(1)).min(1).max(500),
});

export async function GET(req: Request) {
  const auth = await assertAllowed();
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const size = Math.max(1, Math.min(500, Number(searchParams.get('size') || 300)));
  const page = Math.max(1, Number(searchParams.get('page') || 1));

  try {
    const response = await listVirtualAccounts({ size, page });
    const items = normalizeVaItems(response.decoded);
    return NextResponse.json({
      ok: true,
      items,
      raw: response.raw,
      requestId: response.requestId,
      total: items.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Không tải được danh sách VA' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await assertAllowed();
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const data = deleteSchema.parse(body);
    const uniqAccounts = [...new Set(data.vaAccounts.map((x) => String(x || '').trim()).filter(Boolean))];

    const results: { vaAccount: string; ok: boolean; errorCode?: string; errorMessage?: string }[] = [];
    for (const vaAccount of uniqAccounts) {
      // eslint-disable-next-line no-await-in-loop
      const res = await revokeVirtualAccount({ vaAccount });
      const errorCode = String(res.raw?.errorCode || res.decoded?.errorCode || '').trim();
      const errorMessage = String(res.raw?.errorMessage || res.decoded?.errorMessage || '').trim();
      const ok = errorCode === '00' || /success|thành công/i.test(errorMessage);
      results.push({
        vaAccount,
        ok,
        errorCode: errorCode || undefined,
        errorMessage: errorMessage || undefined,
      });
    }

    const success = results.filter((x) => x.ok).length;
    const failed = results.length - success;
    return NextResponse.json({
      ok: failed === 0,
      success,
      failed,
      results,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Xóa VA thất bại' }, { status: 500 });
  }
}
