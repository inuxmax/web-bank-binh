import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import { broadcastAdminAnnouncement, notifyAdminsTelegram } from '@/lib/server/notify';

export const runtime = 'nodejs';

const postSchema = z.object({
  title: z.string().max(120).optional(),
  message: z.string().min(1).max(2000),
  sendWeb: z.boolean().optional(),
  sendTelegram: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'announcements')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  try {
    const body = await req.json();
    const data = postSchema.parse(body);
    const result = await broadcastAdminAnnouncement({
      title: data.title,
      message: data.message,
      sendWeb: data.sendWeb !== false,
      sendTelegram: data.sendTelegram !== false,
      fromAdminId: String(session.userId || 'admin'),
    });
    await notifyAdminsTelegram(
      [
        '📢 ADMIN ĐÃ GỬI THÔNG BÁO HỆ THỐNG',
        data.title ? `Tiêu đề: ${data.title}` : '',
        `Nội dung: ${data.message.slice(0, 180)}${data.message.length > 180 ? '…' : ''}`,
        `Gửi web: ${result.webCount} user`,
        `Gửi Telegram: ${result.telegramCount} user`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

