import 'server-only';

import * as db from '@/lib/server/db';

const LINK_TTL_MS = 15 * 60 * 1000;

function getRuntimeRequire(): NodeRequire {
  if (typeof __non_webpack_require__ !== 'undefined') return __non_webpack_require__;
  return Function('return require')() as NodeRequire;
}

/** Ưu tiên TELEGRAM_BOT_USERNAME (không cần @); không có thì gọi getMe. */
export async function resolveTelegramBotUsername(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  if (fromEnv) return fromEnv;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j = (await r.json()) as { result?: { username?: string } };
    return j.result?.username ? String(j.result.username) : null;
  } catch {
    return null;
  }
}

/**
 * Tạo deep link an toàn (chỉ [0-9a-f], đủ ngắn cho giới hạn Telegram).
 */
export async function createTelegramWebLinkForUser(
  userId: string,
): Promise<{ url: string; expiresAt: number } | { error: string }> {
  const botUser = await resolveTelegramBotUsername();
  if (!botUser) {
    return { error: 'Chưa cấu hình bot (TELEGRAM_BOT_TOKEN hoặc TELEGRAM_BOT_USERNAME).' };
  }
  const crypto = getRuntimeRequire()('crypto') as typeof import('crypto');
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + LINK_TTL_MS;
  await db.setTelegramLinkOffer(userId, token, expiresAt);
  const url = `https://t.me/${botUser}?start=${token}`;
  return { url, expiresAt };
}
