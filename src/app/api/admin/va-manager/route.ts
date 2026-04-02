import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { listVirtualAccounts, revokeVirtualAccount } from '@/lib/server/hpay';
import * as db from '@/lib/server/db';

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

function fallbackItemsFromDb(rows: Record<string, unknown>[]) {
  const map = new Map<string, Record<string, unknown>>();
  const sorted = rows
    .slice()
    .sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
  for (const r of sorted) {
    const vaAccount = String(r.vaAccount || '').trim();
    if (!vaAccount) continue;
    if (map.has(vaAccount)) continue;
    map.set(vaAccount, {
      vaAccount,
      vaName: String(r.vaName || r.name || '').trim(),
      bankCode: String(r.vaBank || '').trim(),
      remark: String(r.remark || r.transferContent || '').trim(),
      status: String(r.status || '').trim() || '—',
      createdAt: Number(r.createdAt || 0) || 0,
    });
  }
  return Array.from(map.values());
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
    let items = normalizeVaItems(response.decoded);
    let source: 'hpay' | 'db_fallback' = 'hpay';
    if (!items.length) {
      const localRows = await db.loadAll();
      items = fallbackItemsFromDb(localRows as unknown as Record<string, unknown>[]);
      source = 'db_fallback';
    }
    return NextResponse.json({
      ok: true,
      items,
      raw: response.raw,
      requestId: response.requestId,
      total: items.length,
      source,
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
    const removedAccounts = new Set<string>();
    for (const vaAccount of uniqAccounts) {
      // eslint-disable-next-line no-await-in-loop
      const res = await revokeVirtualAccount({ vaAccount });
      const errorCode = String(res.raw?.errorCode || res.decoded?.errorCode || '').trim();
      const errorMessage = String(res.raw?.errorMessage || res.decoded?.errorMessage || '').trim();
      const invalidOrMissing = /invalid|non-existing|not exist|không tồn tại/i.test(errorMessage);
      const ok = errorCode === '00' || /success|thành công/i.test(errorMessage) || invalidOrMissing;
      if (ok) removedAccounts.add(vaAccount);
      results.push({
        vaAccount,
        ok,
        errorCode: errorCode || undefined,
        errorMessage: errorMessage || undefined,
      });
    }

    if (removedAccounts.size > 0) {
      const all = await db.loadAll();
      const next = all.filter((r) => !removedAccounts.has(String((r as { vaAccount?: string }).vaAccount || '').trim()));
      await db.saveAll(next);
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
