import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { executeWithdrawalRequest } from '@/lib/server/user-actions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId || session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await executeWithdrawalRequest(session.userId, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }
    return NextResponse.json({
      ok: true,
      id: result.id,
      feeFlat: result.feeFlat,
      feePercent: result.feePercent,
      actualReceive: result.actualReceive,
      balanceAfter: result.balanceAfter,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
