import 'server-only';

import * as db from '@/lib/server/db';
import { normalizeAdminPermissions } from './admin-permissions';

function fmtVnd(n: unknown) {
  return `${(Number(n) || 0).toLocaleString('vi-VN')} đ`;
}

function fmtTimeVN(input: unknown) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const num = Number(raw);
  const ms = Number.isFinite(num) ? (raw.length >= 13 ? num : num * 1000) : NaN;
  const d = Number.isFinite(ms) ? new Date(ms) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
  return `${time}, ${date}`;
}

function collectAdminChatIds(users: Awaited<ReturnType<typeof db.getAllUsers>>) {
  const set = new Set<string>();
  const envIds = String(process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const id of envIds) set.add(id);
  for (const u of users) {
    const perms = normalizeAdminPermissions(u.adminPermissions);
    if (perms.length && String(u.telegramId || '').trim()) {
      set.add(String(u.telegramId || '').trim());
    }
  }
  return [...set];
}

export async function sendTelegramText(chatId: string, text: string): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return false;
    if (!chatId.trim()) return false;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyUserTelegramByUserId(userId: string, text: string): Promise<boolean> {
  const u = await db.findUser(userId);
  const tid = String(u?.telegramId || '').trim();
  if (!tid) return false;
  return sendTelegramText(tid, text);
}

export async function notifyAdminsTelegram(text: string): Promise<number> {
  const users = await db.getAllUsers();
  const ids = collectAdminChatIds(users);
  let sent = 0;
  for (const id of ids) {
    if (await sendTelegramText(id, text)) sent += 1;
  }
  return sent;
}

export async function broadcastAdminAnnouncement(input: {
  title?: string;
  message: string;
  sendWeb?: boolean;
  sendTelegram?: boolean;
  fromAdminId?: string;
}) {
  const users = await db.getAllUsers();
  const title = String(input.title || '').trim();
  const message = String(input.message || '').trim();
  const reason = `admin_notice${title ? `:${title}` : ''} ${message}`.trim();

  let webCount = 0;
  let telegramCount = 0;
  for (const u of users) {
    if (String(u.id) === 'admin') continue;
    if (input.sendWeb !== false) {
      await db.addUserBalanceHistory({
        ts: Date.now(),
        userId: u.id,
        delta: 0,
        balanceAfter: Number(u.balance) || 0,
        reason,
        ref: `admin_notice:${Date.now()}`,
      });
      webCount += 1;
    }
    if (input.sendTelegram !== false && String(u.telegramId || '').trim()) {
      const text = [
        '📢 THÔNG BÁO TỪ ADMIN',
        title ? `Tiêu đề: ${title}` : '',
        message,
      ]
        .filter(Boolean)
        .join('\n');
      if (await sendTelegramText(String(u.telegramId || ''), text)) {
        telegramCount += 1;
      }
    }
  }
  return { totalUsers: users.length, webCount, telegramCount };
}

export function buildWithdrawCreatedText(data: {
  id: string;
  amount: number;
  feeFlat: number;
  feeByPercent: number;
  actualReceive: number;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  balanceAfter: number;
}) {
  return [
    '✅ Yêu cầu rút tiền đã được tạo',
    '',
    `💵 Số tiền rút: ${fmtVnd(data.amount)}`,
    `🏦 Ngân hàng: ${data.bankName}`,
    `💳 STK: ${data.bankAccount}`,
    `👤 Chủ TK: ${data.bankHolder}`,
    `💰 Số dư còn lại: ${fmtVnd(data.balanceAfter)}`,
    '',
    '⏳ Đang chờ duyệt..',
  ].join('\n');
}

export function buildVaPaidText(data: {
  vaAccount?: string;
  bankName?: string;
  ownerName?: string;
  amount?: number;
  credited?: number;
  feeFlat?: number;
  requestId?: string;
  transactionId?: string;
  timePaid?: string;
}) {
  return [
    '🔔 TIỀN VỀ TIỀN VỀ',
    `💵 Số tiền: ${fmtVnd(data.amount)}`,
    `✅ Thực nhận: +${fmtVnd(data.credited)} (đã trừ ${fmtVnd(data.feeFlat)} phí giao dịch)`,
    data.bankName ? `🏦 ${data.bankName}` : '',
    data.ownerName ? ` • Họ Tên: ${data.ownerName}` : '',
    data.vaAccount ? ` • Số TK: ${data.vaAccount}` : '',
    data.timePaid ? ` • Thời Gian: ${fmtTimeVN(data.timePaid)}` : '',
    data.transactionId ? ` • Transaction: ${data.transactionId}` : '',
    data.requestId ? ` • RequestId: ${data.requestId}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWithdrawDoneText(data: {
  amount: number;
  feeFlat: number;
  actualReceive: number;
}) {
  return [
    '✅ Rút tiền thành công!',
    '',
    `💵 Số tiền rút: ${fmtVnd(data.amount)}`,
    `💸 Phí chuyển: ${fmtVnd(data.feeFlat)}`,
    `💰 Thực nhận: ${fmtVnd(data.actualReceive)}`,
    '🏦 Đã chuyển vào tài khoản ngân hàng của bạn.',
  ].join('\n');
}

