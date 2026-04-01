import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { createTelegramWebLinkForUser } from '@/lib/server/telegram-dashboard-link';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  if (!session.userId || session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await createTelegramWebLinkForUser(session.userId);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    url: result.url,
    expiresAt: result.expiresAt,
  });
}
