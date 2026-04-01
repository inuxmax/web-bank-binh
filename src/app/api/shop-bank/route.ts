import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';

export const runtime = 'nodejs';

const buySchema = z.object({
  bankCode: z.string().min(2).max(20),
  quantity: z.number().int().min(1).max(200),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const u = await db.getUser(session.userId);
  if (isUserBanned(u)) return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
  if (!u.isActive) return NextResponse.json({ error: 'Tài khoản chưa được duyệt' }, { status: 403 });

  const [banks, purchases] = await Promise.all([
    db.getShopBankInventoryByBank(),
    db.getShopBankSalesByUser(session.userId, 30),
  ]);
  return NextResponse.json({
    banks,
    purchases,
    balance: Number(u.balance || 0),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const u = await db.getUser(session.userId);
  if (isUserBanned(u)) return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
  if (!u.isActive) return NextResponse.json({ error: 'Tài khoản chưa được duyệt' }, { status: 403 });

  try {
    const body = await req.json();
    const data = buySchema.parse(body);
    const result = await db.buyShopBankRandom({
      userId: session.userId,
      bankCode: data.bankCode,
      quantity: data.quantity,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const fresh = await db.getUser(session.userId);
    return NextResponse.json({
      ok: true,
      saleId: result.saleId,
      quantity: result.quantity,
      totalAmount: result.totalAmount,
      items: result.items.map((x) => ({
        holderName: String(x.holderName || ''),
        accountNumber: String(x.accountNumber || ''),
        bankCode: String(x.bankCode || ''),
        price: Number(x.price) || 0,
      })),
      balance: Number(fresh.balance || 0),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Lỗi hệ thống' }, { status: 500 });
  }
}
