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

const popupSchema = z.object({
  dashboardPopupEnabled: z.boolean(),
  dashboardPopupTitle: z.string().max(160).optional(),
  dashboardPopupBody: z.string().max(4000).optional(),
  dashboardPopupPrimaryLabel: z.string().max(80).optional(),
  dashboardPopupPrimaryUrl: z.string().max(500).optional(),
  dashboardPopupSecondaryLabel: z.string().max(80).optional(),
  dashboardPopupSecondaryUrl: z.string().max(500).optional(),
});

async function requireAnnouncementPermission() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return { ok: false as const, status: 403 };
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'announcements')) return { ok: false as const, status: 403 };
  }
  return { ok: true as const, session };
}

function pickPopupConfig(config: Record<string, unknown>) {
  return {
    dashboardPopupEnabled: config.dashboardPopupEnabled === true,
    dashboardPopupTitle: String(config.dashboardPopupTitle || ''),
    dashboardPopupBody: String(config.dashboardPopupBody || ''),
    dashboardPopupPrimaryLabel: String(config.dashboardPopupPrimaryLabel || ''),
    dashboardPopupPrimaryUrl: String(config.dashboardPopupPrimaryUrl || ''),
    dashboardPopupSecondaryLabel: String(config.dashboardPopupSecondaryLabel || ''),
    dashboardPopupSecondaryUrl: String(config.dashboardPopupSecondaryUrl || ''),
    dashboardPopupUpdatedAt: Number(config.dashboardPopupUpdatedAt || 0),
  };
}

export async function GET() {
  const auth = await requireAnnouncementPermission();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }
  const db = await import('@/lib/server/db');
  const config = await db.getConfig();
  return NextResponse.json({ ok: true, popup: pickPopupConfig(config) });
}

export async function PATCH(req: Request) {
  const auth = await requireAnnouncementPermission();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }
  try {
    const body = await req.json();
    const data = popupSchema.parse(body);
    const now = Date.now();
    const db = await import('@/lib/server/db');
    const config = await db.updateConfig({
      dashboardPopupEnabled: data.dashboardPopupEnabled,
      dashboardPopupTitle: String(data.dashboardPopupTitle || '').trim(),
      dashboardPopupBody: String(data.dashboardPopupBody || '').trim(),
      dashboardPopupPrimaryLabel: String(data.dashboardPopupPrimaryLabel || '').trim(),
      dashboardPopupPrimaryUrl: String(data.dashboardPopupPrimaryUrl || '').trim(),
      dashboardPopupSecondaryLabel: String(data.dashboardPopupSecondaryLabel || '').trim(),
      dashboardPopupSecondaryUrl: String(data.dashboardPopupSecondaryUrl || '').trim(),
      dashboardPopupUpdatedAt: now,
    });
    return NextResponse.json({ ok: true, popup: pickPopupConfig(config) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAnnouncementPermission();
  if (!auth.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: auth.status });
  }
  const session = auth.session;
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

