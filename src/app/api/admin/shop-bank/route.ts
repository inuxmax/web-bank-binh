import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

const postSchema = z.object({
  rows: z.string().min(1),
  price: z.number().int().min(0),
});

function parseRows(raw: string) {
  const out: { holderName: string; accountNumber: string; bankCode: string }[] = [];
  const lines = String(raw || '')
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const line of lines) {
    const parts = line.split('|').map((x) => x.trim());
    if (parts.length < 3) continue;
    const holderName = parts[0];
    const accountNumber = parts[1].replace(/[^\d]/g, '');
    const bankCode = parts[2].toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!holderName || !accountNumber || !bankCode) continue;
    out.push({ holderName, accountNumber, bankCode });
  }
  return out;
}

async function guard() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return { ok: false as const, status: 403 };
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'shop_bank')) return { ok: false as const, status: 403 };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: 'Forbidden' }, { status: g.status });
  const banks = await db.getShopBankInventoryByBank();
  return NextResponse.json({ banks });
}

export async function POST(req: Request) {
  const g = await guard();
  if (!g.ok) return NextResponse.json({ error: 'Forbidden' }, { status: g.status });
  try {
    const body = await req.json();
    const data = postSchema.parse(body);
    const parsedRows = parseRows(data.rows);
    if (!parsedRows.length) {
      return NextResponse.json({ error: 'Không có dòng hợp lệ. Định dạng: TEN|STK|BANK' }, { status: 400 });
    }
    const inserted = await db.addShopBankAccounts(
      parsedRows.map((r) => ({
        ...r,
        price: data.price,
        uploadedBy: g.session.userId,
      })),
    );
    const banks = await db.getShopBankInventoryByBank();
    return NextResponse.json({
      ok: true,
      inserted,
      requested: parsedRows.length,
      skipped: Math.max(0, parsedRows.length - inserted),
      banks,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message || 'Lỗi hệ thống' }, { status: 500 });
  }
}
