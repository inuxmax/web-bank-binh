/**
 * Bot Telegram — mặc định khởi động cùng Next.js (instrumentation.ts) khi có TELEGRAM_BOT_TOKEN.
 * Hoặc chạy riêng: `npm run bot`
 */
import 'server-only';

import * as db from '@/lib/server/db';
import { connectMongo } from '@/lib/server/mongo-connection';
import { createVirtualAccountForOwner, executeWithdrawalRequest } from '@/lib/server/user-actions';
import { findIbftBanks, getIbftBankLabel, IBFT_BANK_PICK_CODES } from '@/lib/banks';

function getRuntimeRequire(): NodeRequire {
  if (typeof __non_webpack_require__ !== 'undefined') return __non_webpack_require__;
  return Function('return require')() as NodeRequire;
}

function loadTelegrafRuntime(): typeof import('telegraf') {
  return getRuntimeRequire()('telegraf') as typeof import('telegraf');
}

function loadEnvLocal() {
  if (process.env.TELEGRAM_BOT_TOKEN?.trim()) return;
  let fs: typeof import('fs');
  let pathMod: typeof import('path');
  try {
    fs = getRuntimeRequire()('fs');
    pathMod = getRuntimeRequire()('path');
  } catch {
    return;
  }
  const p = pathMod.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

const BTN_RANDOM = '🎲 Random tên';
const BTN_INPUT_NAME = '✍️ Nhập tên';
const BTN_ACCOUNT = '🔎 Kiểm tra tài khoản';
const BTN_WITHDRAW = '💸 Rút tiền';
const BTN_VAS = '📦 VA đã tạo';
const BTN_INFO = 'ℹ️ Thông tin';
const BTN_CANCEL = '❌ Hủy';
const BTN_CREATE_VA_CONFIRM = '✅ Tạo VA';
const CB_RANDOM_PICK_PREFIX = 'rnd_pick:';
const CB_RANDOM_CONFIRM_CREATE = 'rnd_create';
const CB_RANDOM_CANCEL = 'rnd_cancel';
const CB_MANUAL_CONFIRM_CREATE = 'man_create';
const CB_MANUAL_CANCEL = 'man_cancel';
const CB_VA_BANK_PICK_PREFIX = 'va_bank:';
const CB_VA_BANK_CANCEL = 'va_bank_cancel';
const CB_WD_SAVED_PICK_PREFIX = 'wd_saved:';
const CB_WD_SAVED_OTHER = 'wd_saved_other';
const CB_WD_BANK_PICK_PREFIX = 'wd_bank:';
const CB_WD_BANK_PAGE_PREFIX = 'wd_bank_page:';
const CB_WD_CANCEL = 'wd_cancel';
const CB_VAS_PAGE_PREFIX = 'vas_page:';

const MENU_LABELS = new Set([
  BTN_RANDOM,
  BTN_INPUT_NAME,
  BTN_ACCOUNT,
  BTN_WITHDRAW,
  BTN_VAS,
  BTN_INFO,
]);

function mainKeyboard(Markup: typeof import('telegraf').Markup) {
  return Markup.keyboard([
    [BTN_RANDOM, BTN_INPUT_NAME],
    [BTN_ACCOUNT, BTN_WITHDRAW, BTN_VAS],
    [BTN_INFO],
  ]).resize();
}

type BotSession = {
  flow?:
    | 'link_login'
    | 'link_pass'
    | 'account_check_va'
    | 'random_prefix'
    | 'random_pick'
    | 'random_confirm'
    | 'va_bank_pick'
    | 'va_name'
    | 'va_name_confirm'
    | 'withdraw_amt'
    | 'withdraw_saved_pick'
    | 'withdraw_bank'
    | 'withdraw_acc'
    | 'withdraw_holder';
  linkLogin?: string;
  wdAmount?: number;
  wdBank?: string;
  wdAccount?: string;
  wdSavedIndex?: number;
  wdBankPage?: number;
  randomPrefix?: string;
  randomOptions?: string[];
  randomSelected?: string;
  manualName?: string;
  pendingVaName?: string;
  vaCreateBankCode?: 'MSB' | 'KLB';
};

const sessions = new Map<number, BotSession>();

function sess(chatId: number): BotSession {
  if (!sessions.has(chatId)) sessions.set(chatId, {});
  return sessions.get(chatId)!;
}

function resetFlow(st: BotSession) {
  delete st.flow;
  delete st.linkLogin;
  delete st.wdAmount;
  delete st.wdBank;
  delete st.wdAccount;
  delete st.wdSavedIndex;
  delete st.wdBankPage;
  delete st.randomPrefix;
  delete st.randomOptions;
  delete st.randomSelected;
  delete st.manualName;
  delete st.pendingVaName;
  delete st.vaCreateBankCode;
}

const HO = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dang', 'Bui', 'Do'];
const DEM = ['Van', 'Thi', 'Duc', 'Minh', 'Anh', 'Hong', 'Quang', 'Thanh'];
const TEN = ['An', 'Binh', 'Cuong', 'Dung', 'Hung', 'Linh', 'Nam', 'Phuong', 'Quan', 'Tam', 'Tung'];

type DecodedVaLike = Record<string, unknown> & { quickLink?: string };

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomVaName() {
  return `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`;
}

function normalizeNamePart(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildRandomNameOptions(prefixRaw: string, count = 3): string[] {
  const prefix = normalizeNamePart(prefixRaw);
  const results: string[] = [];
  const used = new Set<string>();

  if (!prefix) return results;

  while (results.length < count && used.size < TEN.length * 2) {
    const last = pick(TEN).toUpperCase();
    const full = `${prefix} ${last}`.replace(/\s+/g, ' ').trim();
    if (used.has(full)) continue;
    used.add(full);
    results.push(full);
  }
  return results;
}

function randomPickInlineKeyboard(options: string[], Markup: typeof import('telegraf').Markup) {
  return Markup.inlineKeyboard(
    [
      ...options.map((name, idx) => Markup.button.callback(`✅ ${name}`, `${CB_RANDOM_PICK_PREFIX}${idx}`)),
      Markup.button.callback(BTN_CANCEL, CB_RANDOM_CANCEL),
    ],
    { columns: 1 },
  );
}

function randomConfirmInlineKeyboard(Markup: typeof import('telegraf').Markup) {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback(BTN_CREATE_VA_CONFIRM, CB_RANDOM_CONFIRM_CREATE),
      Markup.button.callback(BTN_CANCEL, CB_RANDOM_CANCEL),
    ],
    { columns: 1 },
  );
}

function manualConfirmInlineKeyboard(Markup: typeof import('telegraf').Markup) {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback(BTN_CREATE_VA_CONFIRM, CB_MANUAL_CONFIRM_CREATE),
      Markup.button.callback(BTN_CANCEL, CB_MANUAL_CANCEL),
    ],
    { columns: 1 },
  );
}

function vaCreateBankInlineKeyboard(Markup: typeof import('telegraf').Markup) {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback('🏦 MSB', `${CB_VA_BANK_PICK_PREFIX}MSB`),
      Markup.button.callback('🏦 KLB', `${CB_VA_BANK_PICK_PREFIX}KLB`),
      Markup.button.callback(BTN_CANCEL, CB_VA_BANK_CANCEL),
    ],
    { columns: 2 },
  );
}

type SavedWithdrawAccount = {
  bankCode: string;
  bankAccount: string;
  bankHolder: string;
  updatedAt: number;
};

function normalizeWdBankAccount(v: string) {
  return String(v || '')
    .replace(/[^\d]/g, '')
    .slice(0, 24);
}

function normalizeWdBankHolder(v: string) {
  return String(v || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function getSavedWithdrawAccounts(user: db.UserRecord): SavedWithdrawAccount[] {
  const raw = Array.isArray(user.savedWithdrawAccounts) ? user.savedWithdrawAccounts : [];
  return raw
    .map((r) => ({
      bankCode: String(r.bankCode || '').trim().toUpperCase(),
      bankAccount: normalizeWdBankAccount(String(r.bankAccount || '')),
      bankHolder: normalizeWdBankHolder(String(r.bankHolder || '')),
      updatedAt: Number(r.updatedAt) || 0,
    }))
    .filter((r) => r.bankCode && r.bankAccount.length >= 6 && r.bankHolder);
}

async function upsertSavedWithdrawAccountForUser(
  userId: string,
  bankCode: string,
  bankAccount: string,
  bankHolder: string,
) {
  const user = await db.getUser(userId);
  const current = getSavedWithdrawAccounts(user);
  const next: SavedWithdrawAccount = {
    bankCode: String(bankCode || '').trim().toUpperCase(),
    bankAccount: normalizeWdBankAccount(bankAccount),
    bankHolder: normalizeWdBankHolder(bankHolder),
    updatedAt: Date.now(),
  };
  if (!next.bankCode || next.bankAccount.length < 6 || !next.bankHolder) return;
  const dedup = current.filter((r) => !(r.bankCode === next.bankCode && r.bankAccount === next.bankAccount));
  const merged = [next, ...dedup].slice(0, 8);
  await db.updateUser(userId, { savedWithdrawAccounts: merged });
}

function savedWithdrawInlineKeyboard(items: SavedWithdrawAccount[], Markup: typeof import('telegraf').Markup) {
  return Markup.inlineKeyboard(
    [
      ...items.map((it, idx) =>
        Markup.button.callback(
          `${it.bankCode} - ${it.bankAccount} (${it.bankHolder.slice(0, 18)})`,
          `${CB_WD_SAVED_PICK_PREFIX}${idx}`,
        ),
      ),
      Markup.button.callback('🏦 Chọn ngân hàng khác', CB_WD_SAVED_OTHER),
      Markup.button.callback(BTN_CANCEL, CB_WD_CANCEL),
    ],
    { columns: 1 },
  );
}

function withdrawBankInlineKeyboard(page: number, Markup: typeof import('telegraf').Markup) {
  const pageSize = 12;
  const total = IBFT_BANK_PICK_CODES.length;
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  const safePage = Math.max(0, Math.min(page, maxPage));
  const start = safePage * pageSize;
  const rows = IBFT_BANK_PICK_CODES.slice(start, start + pageSize);
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (safePage > 0) nav.push(Markup.button.callback('⬅️ Quay lại', `${CB_WD_BANK_PAGE_PREFIX}${safePage - 1}`));
  if (safePage < maxPage) nav.push(Markup.button.callback('Sau ➡️', `${CB_WD_BANK_PAGE_PREFIX}${safePage + 1}`));

  return {
    page: safePage,
    markup: Markup.inlineKeyboard(
      [
        ...rows.map((code) => Markup.button.callback(getIbftBankLabel(code), `${CB_WD_BANK_PICK_PREFIX}${code}`)),
        ...(nav.length ? nav : []),
        Markup.button.callback(BTN_CANCEL, CB_WD_CANCEL),
      ],
      { columns: 3 },
    ),
  };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function renderVaCreatedMessage(decoded: DecodedVaLike): string {
  const bankCode = pickString(decoded, ['vaBank', 'bankCode']).toUpperCase();
  const bankName =
    pickString(decoded, ['vaBankName', 'bankName']) ||
    (bankCode ? getIbftBankLabel(bankCode) : '');
  const bankDisplay = bankName
    ? `${bankName}${bankCode ? ` (${bankCode})` : ''}`
    : bankCode || '—';

  const accountName = pickString(decoded, ['accountName', 'vaName', 'name']) || '—';
  const accountNo = pickString(decoded, ['vaAccount', 'accountNo', 'accountNumber']) || '—';
  const content = pickString(decoded, ['remark', 'addInfo', 'description']) || '—';

  return [
    '✅ Tạo Virtual Account thành công',
    `🏦 Ngân hàng: ${bankDisplay}`,
    `👤 Tên tài khoản: ${accountName}`,
    `💳 Số tài khoản: ${accountNo}`,
    `📝 Nội dung: ${content}`,
  ].join('\n');
}

function toMoney(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pickRecordString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

function formatVaCheckResult(row: Record<string, unknown>, inputAccount: string): string {
  const statusRaw = pickRecordString(row, ['status', 'tranStatus']).toUpperCase() || 'UNKNOWN';
  const statusEmoji = statusRaw === 'PAID' ? '✅' : statusRaw === 'UNPAID' ? '🕗' : '⚠️';
  const amount = toMoney(row.netAmount ?? row.amount ?? row.vaAmount);
  const bankCode = pickRecordString(row, ['vaBank', 'bankCode']).toUpperCase();
  const bank = bankCode ? `${getIbftBankLabel(bankCode)}${bankCode ? ` (${bankCode})` : ''}` : '—';
  const owner = pickRecordString(row, ['name', 'vaName', 'accountName']) || '—';
  const remark = pickRecordString(row, ['remark', 'addInfo', 'description']) || '—';
  const timeRaw = pickRecordString(row, ['timePaid', 'paidAt', 'createdAt']);
  const ts = Number(timeRaw);
  const timeText = Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString('vi-VN') : timeRaw || '—';
  const requestId = pickRecordString(row, ['requestId', 'clientRequestId']) || '—';
  const tx = pickRecordString(row, ['transactionId', 'tranId']) || '—';
  const cashin = pickRecordString(row, ['cashinId', 'cashInId']) || '—';

  return [
    '🔎 KẾT QUẢ KIỂM TRA',
    '',
    `💳 STK: ${inputAccount}`,
    `🆔 RequestId: ${requestId}`,
    `📌 Trạng thái: ${statusEmoji} ${statusRaw}`,
    `💰 Số tiền: ${amount.toLocaleString('vi-VN')} đ`,
    `🏦 Ngân hàng: ${bank}`,
    `👤 Tên: ${owner}`,
    `📝 Nội dung: ${remark}`,
    `🕒 Thời gian: ${timeText}`,
    `↪️ Transaction: ${tx}`,
    `🧾 CASHIN: ${cashin}`,
  ].join('\n');
}

function renderVaListPage(rows: Record<string, unknown>[], page: number, pageSize = 4): string {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const items = rows.slice(start, start + pageSize);
  const body = items
    .map((r) => {
      const statusRaw = pickRecordString(r, ['status', 'tranStatus']) || 'unknown';
      const statusText = statusRaw.toLowerCase();
      const statusEmoji = statusText === 'paid' ? '✅' : statusText === 'unpaid' ? '🕗' : '⚠️';
      const amount = toMoney(r.netAmount ?? r.amount ?? r.vaAmount);
      const bankCode = pickRecordString(r, ['vaBank', 'bankCode']).toUpperCase() || '—';
      const acc = pickRecordString(r, ['vaAccount', 'accountNo', 'accountNumber']) || '—';
      const owner = pickRecordString(r, ['name', 'vaName', 'accountName']) || '—';
      const rid = pickRecordString(r, ['requestId']) || '—';
      const tx = pickRecordString(r, ['transactionId', 'tranId']);
      const ridLine = tx ? `${rid}:${tx}` : rid;
      return [
        `• ${statusEmoji} ${statusText} | ${amount.toLocaleString('vi-VN')}đ`,
        `🏦 ${bankCode} | 💳 ${acc}`,
        `👤 ${owner}`,
        `🆔 ${ridLine}`,
      ].join('\n');
    })
    .join('\n\n');
  return `📂 VA đã tạo (${safePage + 1}/${totalPages})\n\n${body}`;
}

function vasPageInlineKeyboard(
  page: number,
  totalItems: number,
  Markup: typeof import('telegraf').Markup,
  pageSize = 4,
) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (safePage > 0) nav.push(Markup.button.callback('⬅️ Quay lại', `${CB_VAS_PAGE_PREFIX}${safePage - 1}`));
  if (safePage < totalPages - 1) nav.push(Markup.button.callback('Sau ➡️', `${CB_VAS_PAGE_PREFIX}${safePage + 1}`));
  if (!nav.length) return undefined;
  return Markup.inlineKeyboard(nav, { columns: nav.length });
}

async function linkedUser(telegramUserId: number) {
  return db.findUserByTelegramId(String(telegramUserId));
}

function appUrl() {
  return (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

function publicWebsiteUrl() {
  return String(process.env.PUBLIC_WEBSITE_URL || 'https://thuebank.net').trim();
}

function renderPendingApproveStartMessage(u: db.UserRecord) {
  const name = String(u.fullName || u.username || u.webLogin || '').trim() || '—';
  return [
    '🔐 TÀI KHOẢN CHƯA ĐƯỢC DUYỆT!',
    '',
    `🆔 User ID của bạn: ${u.id}`,
    `👤 Tên: ${name}`,
    '',
    '📋 Hướng dẫn:',
    `1) Truy cập website: ${publicWebsiteUrl()}`,
    '2) Đăng nhập và theo dõi trạng thái duyệt tài khoản',
    '3) Chờ admin duyệt, bot sẽ thông báo tự động',
  ].join('\n');
}

const BOT_LAUNCH_KEY = '__hpayTelegramBotLaunch' as const;

export type StartTelegramBotOptions = {
  /** Gắn SIGINT/SIGTERM để dừng bot gọn (chỉ nên bật khi chạy `npm run bot`) */
  registerSignalHandlers?: boolean;
  /** Thoát process nếu thiếu token (CLI); false = im lặng bỏ qua (nhúng vào Next) */
  exitOnMissingToken?: boolean;
};

export function startTelegramBot(options: StartTelegramBotOptions = {}): Promise<void> {
  const g = globalThis as typeof globalThis & { [BOT_LAUNCH_KEY]?: Promise<void> };
  if (!g[BOT_LAUNCH_KEY]) {
    g[BOT_LAUNCH_KEY] = runTelegramBotImpl(options);
  }
  return g[BOT_LAUNCH_KEY];
}

async function runTelegramBotImpl(options: StartTelegramBotOptions): Promise<void> {
  loadEnvLocal();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    if (options.exitOnMissingToken) {
      console.error('Thiếu TELEGRAM_BOT_TOKEN trong .env.local');
      process.exit(1);
    }
    return;
  }

  await connectMongo();
  const { Telegraf, Markup } = loadTelegrafRuntime();
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    resetFlow(sess(ctx.chat!.id));
    const tid = ctx.from?.id;
    if (tid) {
      const linked = await linkedUser(tid);
      if (linked && !linked.isActive) {
        await ctx.reply(renderPendingApproveStartMessage(linked));
        return;
      }
    }
    const payload = String(ctx.payload || (ctx as { startPayload?: string }).startPayload || '').trim();
    if (payload) {
      const r = await db.redeemTelegramDeepLink(payload, String(ctx.from?.id || ''));
      if (r.ok) {
        const linked = await linkedUser(Number(ctx.from?.id || 0));
        if (linked && !linked.isActive) {
          await ctx.reply(renderPendingApproveStartMessage(linked));
          return;
        }
        await ctx.reply(
          '✅ Đã kết nối Telegram với tài khoản web. Bạn có thể dùng các nút bên dưới.',
          mainKeyboard(Markup),
        );
        return;
      }
      await ctx.reply(
        `❌ ${r.error}\n\nBạn vẫn có thể dùng /lienket (nhập mật khẩu web) để liên kết thủ công.`,
        mainKeyboard(Markup),
      );
      return;
    }
    await ctx.reply(
      [
        'Chào bạn! Đây là bot Sinpay (liên kết với web).',
        '',
        '• Liên kết nhanh: mở link từ trang web (Dashboard).',
        '• Hoặc dùng /lienket để nhập login + mật khẩu.',
        '• Hủy liên kết: /huylket',
        '',
        `Web: ${appUrl()}`,
      ].join('\n'),
      mainKeyboard(Markup),
    );
  });

  bot.command('lienket', async (ctx) => {
    const st = sess(ctx.chat!.id);
    resetFlow(st);
    st.flow = 'link_login';
    await ctx.reply('Gửi tên đăng nhập web (webLogin):');
  });

  bot.command('huylket', async (ctx) => {
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply('Chưa liên kết tài khoản nào.');
      return;
    }
    await db.clearTelegramFromUser(u.id);
    resetFlow(sess(ctx.chat!.id));
    await ctx.reply('Đã hủy liên kết Telegram với tài khoản web.');
  });

  bot.hears(BTN_INFO, async (ctx) => {
    resetFlow(sess(ctx.chat!.id));
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply(
        [
          'ℹ️ Thông tin',
          '',
          `• Web console: ${appUrl()}`,
          '• Chưa liên kết tài khoản. Dùng /lienket trước.',
          '',
          'Lệnh: /lienket · /huylket · /start',
        ].join('\n'),
      );
      return;
    }
    const fresh = await db.getUser(u.id);
    const login = fresh.webLogin || fresh.username || '—';
    await ctx.reply(
      [
        'ℹ️ Thông tin tài khoản',
        `Login: ${login}`,
        `ID: ${fresh.id}`,
        `Duyệt (active): ${fresh.isActive ? 'Có ✓' : 'Chưa — chờ admin'}`,
        `Số dư: ${Number(fresh.balance || 0).toLocaleString('vi-VN')} đ`,
        `VA đã tạo: ${fresh.createdVA}${fresh.vaLimit != null ? ` / giới hạn ${fresh.vaLimit}` : ''}`,
        '',
        `Web console: ${appUrl()}`,
      ].join('\n'),
    );
  });

  bot.hears(BTN_ACCOUNT, async (ctx) => {
    const st = sess(ctx.chat!.id);
    resetFlow(st);
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply('Chưa liên kết. Dùng /lienket trước.');
      return;
    }
    st.flow = 'account_check_va';
    await ctx.reply('Nhập Số tài khoản (vaAccount) để kiểm tra:');
  });

  bot.hears(BTN_VAS, async (ctx) => {
    resetFlow(sess(ctx.chat!.id));
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply('Chưa liên kết. Dùng /lienket trước.');
      return;
    }
    const rows = await db.getVAsByUser(u.id, 120);
    if (!rows.length) {
      await ctx.reply('Chưa có VA nào.');
      return;
    }
    const data = rows as Record<string, unknown>[];
    await ctx.reply(renderVaListPage(data, 0), vasPageInlineKeyboard(0, data.length, Markup));
  });

  bot.hears(BTN_RANDOM, async (ctx) => {
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply('Chưa liên kết. Dùng /lienket trước.');
      return;
    }
    const st = sess(ctx.chat!.id);
    resetFlow(st);
    st.flow = 'random_prefix';
    await ctx.reply(
      'Gửi họ và tên đệm để random tên (ví dụ: PHAM VAN hoặc LE DUC ANH).',
      Markup.removeKeyboard(),
    );
  });

  bot.hears(BTN_INPUT_NAME, async (ctx) => {
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply('Chưa liên kết. Dùng /lienket trước.');
      return;
    }
    const st = sess(ctx.chat!.id);
    resetFlow(st);
    st.flow = 'va_name';
    await ctx.reply('Gửi tên hiển thị cho VA (2–50 ký tự, ví dụ họ tên):');
  });

  bot.hears(BTN_WITHDRAW, async (ctx) => {
    const tid = ctx.from?.id;
    if (!tid) return;
    const u = await linkedUser(tid);
    if (!u) {
      await ctx.reply('Chưa liên kết. Dùng /lienket trước.');
      return;
    }
    const st = sess(ctx.chat!.id);
    resetFlow(st);
    st.flow = 'withdraw_amt';
    await ctx.reply('💸 Rút tiền — gửi số tiền (VNĐ, số nguyên), ví dụ: 500000');
  });

  bot.on('callback_query', async (ctx) => {
    const chatId = ctx.chat?.id;
    const tid = ctx.from?.id;
    if (!chatId || !tid) return;

    const data = String((ctx.callbackQuery as { data?: string })?.data || '');
    if (!data) return;

    const st = sess(chatId);

    if (data === CB_RANDOM_CANCEL) {
      resetFlow(st);
      await ctx.answerCbQuery('Đã hủy');
      await ctx.reply('Đã hủy thao tác random tên.', mainKeyboard(Markup));
      return;
    }

    if (data === CB_MANUAL_CANCEL) {
      resetFlow(st);
      await ctx.answerCbQuery('Đã hủy');
      await ctx.reply('Đã hủy thao tác nhập tên.', mainKeyboard(Markup));
      return;
    }

    if (data === CB_VA_BANK_CANCEL) {
      resetFlow(st);
      await ctx.answerCbQuery('Đã hủy');
      await ctx.reply('Đã hủy thao tác tạo VA.', mainKeyboard(Markup));
      return;
    }

    if (data === CB_WD_CANCEL) {
      resetFlow(st);
      await ctx.answerCbQuery('Đã hủy');
      await ctx.reply('Đã hủy thao tác rút tiền.', mainKeyboard(Markup));
      return;
    }

    if (data.startsWith(CB_VAS_PAGE_PREFIX)) {
      const u = await linkedUser(tid);
      if (!u) {
        await ctx.answerCbQuery('Chưa liên kết tài khoản.');
        return;
      }
      const page = Number(data.slice(CB_VAS_PAGE_PREFIX.length));
      const rows = (await db.getVAsByUser(u.id, 120)) as Record<string, unknown>[];
      if (!rows.length) {
        await ctx.answerCbQuery();
        await ctx.reply('Chưa có VA nào.');
        return;
      }
      const totalPages = Math.max(1, Math.ceil(rows.length / 4));
      const safePage = Number.isFinite(page) ? Math.max(0, Math.min(page, totalPages - 1)) : 0;
      await ctx.answerCbQuery();
      try {
        await ctx.editMessageText(renderVaListPage(rows, safePage), {
          reply_markup: vasPageInlineKeyboard(safePage, rows.length, Markup)?.reply_markup,
        });
      } catch {
        await ctx.reply(renderVaListPage(rows, safePage), vasPageInlineKeyboard(safePage, rows.length, Markup));
      }
      return;
    }

    if (data.startsWith(CB_RANDOM_PICK_PREFIX)) {
      if (st.flow !== 'random_pick') {
        await ctx.answerCbQuery('Phiên chọn tên đã hết hạn.');
        return;
      }
      const idx = Number(data.slice(CB_RANDOM_PICK_PREFIX.length));
      const options = st.randomOptions || [];
      const selected = Number.isInteger(idx) && idx >= 0 && idx < options.length ? options[idx] : undefined;
      if (!selected) {
        await ctx.answerCbQuery('Lựa chọn không hợp lệ');
        return;
      }
      st.randomSelected = selected;
      st.flow = 'random_confirm';
      await ctx.answerCbQuery(`Đã chọn ${selected}`);
      await ctx.reply(`Bạn đã chọn: ${selected}\nXác nhận tạo VA?`, randomConfirmInlineKeyboard(Markup));
      return;
    }

    if (data === CB_RANDOM_CONFIRM_CREATE) {
      if (st.flow !== 'random_confirm') {
        await ctx.answerCbQuery('Phiên xác nhận đã hết hạn.');
        return;
      }
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.answerCbQuery();
        await ctx.reply('Mất liên kết. /lienket lại.', mainKeyboard(Markup));
        return;
      }
      const selectedName = String(st.randomSelected || '').trim();
      if (!selectedName) {
        await ctx.answerCbQuery();
        await ctx.reply('Không tìm thấy tên đã chọn. Vui lòng thử lại.', mainKeyboard(Markup));
        return;
      }
      st.pendingVaName = selectedName;
      st.flow = 'va_bank_pick';
      await ctx.answerCbQuery('Chọn ngân hàng tạo VA');
      await ctx.reply(
        `Bạn đã chọn tên: ${selectedName}\nChọn ngân hàng tạo VA (MSB/KLB):`,
        vaCreateBankInlineKeyboard(Markup),
      );
      return;
    }

    if (data === CB_MANUAL_CONFIRM_CREATE) {
      if (st.flow !== 'va_name_confirm') {
        await ctx.answerCbQuery('Phiên xác nhận đã hết hạn.');
        return;
      }
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.answerCbQuery();
        await ctx.reply('Mất liên kết. /lienket lại.', mainKeyboard(Markup));
        return;
      }
      const manualName = String(st.manualName || '').trim();
      if (!manualName) {
        await ctx.answerCbQuery();
        await ctx.reply('Không tìm thấy tên đã nhập. Vui lòng thử lại.', mainKeyboard(Markup));
        return;
      }
      st.pendingVaName = manualName;
      st.flow = 'va_bank_pick';
      await ctx.answerCbQuery('Chọn ngân hàng tạo VA');
      await ctx.reply(
        `Bạn đã nhập tên: ${manualName}\nChọn ngân hàng tạo VA (MSB/KLB):`,
        vaCreateBankInlineKeyboard(Markup),
      );
      return;
    }

    if (data.startsWith(CB_VA_BANK_PICK_PREFIX)) {
      if (st.flow !== 'va_bank_pick') {
        await ctx.answerCbQuery('Phiên chọn ngân hàng tạo VA đã hết hạn.');
        return;
      }
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.answerCbQuery();
        await ctx.reply('Mất liên kết. /lienket lại.', mainKeyboard(Markup));
        return;
      }
      const bankCode = data.slice(CB_VA_BANK_PICK_PREFIX.length).trim().toUpperCase();
      if (bankCode !== 'MSB' && bankCode !== 'KLB') {
        await ctx.answerCbQuery('Ngân hàng không hợp lệ');
        return;
      }
      const selectedName = String(st.pendingVaName || '').trim();
      resetFlow(st);
      if (!selectedName) {
        await ctx.answerCbQuery();
        await ctx.reply('Không tìm thấy tên tạo VA. Vui lòng làm lại.', mainKeyboard(Markup));
        return;
      }

      await ctx.answerCbQuery('Đang tạo VA...');
      await ctx.reply(
        `Đang tạo VA tên: «${selectedName}»\nNgân hàng: ${bankCode}...`,
        mainKeyboard(Markup),
      );
      const result = await createVirtualAccountForOwner(u.id, selectedName, {
        isAdminContext: false,
        bankCode,
      });
      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}${result.hint ? `\n${result.hint}` : ''}`, mainKeyboard(Markup));
        return;
      }
      const d = (result.decoded || {}) as DecodedVaLike;
      await ctx.reply(renderVaCreatedMessage(d), mainKeyboard(Markup));
      if (d.quickLink) {
        try {
          await ctx.replyWithPhoto({ url: d.quickLink }, mainKeyboard(Markup));
        } catch {
          await ctx.reply('Không tải được ảnh QR lúc này. Vui lòng thử lại sau.', mainKeyboard(Markup));
        }
      }
      return;
    }

    if (data === CB_WD_SAVED_OTHER) {
      if (st.flow !== 'withdraw_saved_pick' && st.flow !== 'withdraw_bank') {
        await ctx.answerCbQuery('Phiên chọn ngân hàng đã hết hạn.');
        return;
      }
      st.flow = 'withdraw_bank';
      st.wdBankPage = 0;
      const kb = withdrawBankInlineKeyboard(0, Markup);
      await ctx.answerCbQuery();
      await ctx.reply('🏦 Chọn ngân hàng nhận tiền (danh sách đầy đủ như trên web):', kb.markup);
      return;
    }

    if (data.startsWith(CB_WD_BANK_PAGE_PREFIX)) {
      if (st.flow !== 'withdraw_bank') {
        await ctx.answerCbQuery('Phiên chọn ngân hàng đã hết hạn.');
        return;
      }
      const page = Number(data.slice(CB_WD_BANK_PAGE_PREFIX.length));
      const kb = withdrawBankInlineKeyboard(Number.isFinite(page) ? page : 0, Markup);
      st.wdBankPage = kb.page;
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(kb.markup.reply_markup);
      return;
    }

    if (data.startsWith(CB_WD_BANK_PICK_PREFIX)) {
      if (st.flow !== 'withdraw_bank') {
        await ctx.answerCbQuery('Phiên chọn ngân hàng đã hết hạn.');
        return;
      }
      const code = data.slice(CB_WD_BANK_PICK_PREFIX.length).trim().toUpperCase();
      if (!/^[A-Z0-9]{2,10}$/.test(code)) {
        await ctx.answerCbQuery('Mã ngân hàng không hợp lệ');
        return;
      }
      st.wdBank = code;
      st.flow = 'withdraw_acc';
      await ctx.answerCbQuery(`Đã chọn ${getIbftBankLabel(code)}`);
      await ctx.reply(`NH: ${getIbftBankLabel(code)} (${code}). Gửi số tài khoản nhận tiền:`);
      return;
    }

    if (data.startsWith(CB_WD_SAVED_PICK_PREFIX)) {
      if (st.flow !== 'withdraw_saved_pick') {
        await ctx.answerCbQuery('Phiên chọn tài khoản đã hết hạn.');
        return;
      }
      const idx = Number(data.slice(CB_WD_SAVED_PICK_PREFIX.length));
      if (!Number.isInteger(idx) || idx < 0) {
        await ctx.answerCbQuery('Lựa chọn không hợp lệ');
        return;
      }
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.answerCbQuery();
        await ctx.reply('Mất liên kết. /lienket lại.', mainKeyboard(Markup));
        return;
      }
      const saved = getSavedWithdrawAccounts(u);
      const pick = saved[idx];
      const amount = st.wdAmount;
      if (!pick || !amount) {
        await ctx.answerCbQuery('Không tìm thấy tài khoản đã lưu.');
        return;
      }
      await ctx.answerCbQuery('Đang tạo lệnh rút...');
      resetFlow(st);
      const result = await executeWithdrawalRequest(u.id, {
        bankCode: pick.bankCode,
        bankAccount: pick.bankAccount,
        bankHolder: pick.bankHolder,
        amount,
      });
      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`, mainKeyboard(Markup));
        return;
      }
      await upsertSavedWithdrawAccountForUser(u.id, pick.bankCode, pick.bankAccount, pick.bankHolder);
      await ctx.reply(
        [
          '✅ Đã tạo lệnh rút tiền',
          `Mã: ${result.id}`,
          `Thực nhận (sau phí): ${result.actualReceive.toLocaleString('vi-VN')} đ`,
          `Số dư sau: ${result.balanceAfter.toLocaleString('vi-VN')} đ`,
          '',
          'Admin sẽ xử lý trên web.',
        ].join('\n'),
        mainKeyboard(Markup),
      );
      return;
    }
  });

  bot.on('text', async (ctx) => {
    const chatId = ctx.chat?.id;
    const tid = ctx.from?.id;
    if (!chatId || !tid) return;
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;

    const st = sess(chatId);

    if (MENU_LABELS.has(text)) return;

    if (st.flow === 'link_login') {
      st.linkLogin = text;
      st.flow = 'link_pass';
      await ctx.reply('Nhập mật khẩu web:');
      return;
    }

    if (st.flow === 'link_pass') {
      const { linkTelegramWithCredentials } = await import('@/lib/server/telegram-link');
      const r = await linkTelegramWithCredentials(String(tid), st.linkLogin || '', text);
      resetFlow(st);
      if (!r.ok) {
        await ctx.reply(`❌ ${r.error}`);
        return;
      }
      await ctx.reply(
        '✅ Đã liên kết tài khoản web. Bạn có thể dùng các nút bên dưới.',
        mainKeyboard(Markup),
      );
      return;
    }

    if (st.flow === 'account_check_va') {
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.reply('Mất liên kết. /lienket lại.');
        return;
      }
      const inputAccount = String(text || '').replace(/[^\d]/g, '').trim();
      if (inputAccount.length < 6) {
        await ctx.reply('Số tài khoản không hợp lệ. Vui lòng nhập lại vaAccount.');
        return;
      }
      const rows = await db.getVAsByUser(u.id, 300);
      const found = rows
        .filter((r) => String(r.vaAccount || '').trim() === inputAccount)
        .sort((a, b) => Number(b.timePaid || b.createdAt || 0) - Number(a.timePaid || a.createdAt || 0))[0];
      if (!found) {
        await ctx.reply('Không tìm thấy VA này trong danh sách VA đã tạo của bạn.');
        return;
      }
      resetFlow(st);
      await ctx.reply(formatVaCheckResult(found as Record<string, unknown>, inputAccount), mainKeyboard(Markup));
      return;
    }

    if (st.flow === 'va_name') {
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.reply('Mất liên kết. /lienket lại.');
        return;
      }
      const nameInput = text.trim();
      if (nameInput.length < 2) {
        await ctx.reply('Tên quá ngắn. Vui lòng nhập từ 2 ký tự.');
        return;
      }
      st.manualName = nameInput;
      st.flow = 'va_name_confirm';
      await ctx.reply(
        `Bạn đã nhập tên: ${nameInput}\nXác nhận tạo VA?`,
        manualConfirmInlineKeyboard(Markup),
      );
      return;
    }

    if (st.flow === 'va_name_confirm') {
      await ctx.reply('Vui lòng xác nhận bằng nút ngay trong đoạn chat ở trên.');
      return;
    }

    if (st.flow === 'va_bank_pick') {
      await ctx.reply('Vui lòng chọn ngân hàng tạo VA bằng nút trong đoạn chat ở trên.');
      return;
    }

    if (st.flow === 'random_prefix') {
      const normalized = normalizeNamePart(text);
      if (normalized.length < 2) {
        await ctx.reply('Họ và tên đệm chưa hợp lệ. Ví dụ: PHAM VAN');
        return;
      }
      const options = buildRandomNameOptions(normalized, 3);
      if (!options.length) {
        await ctx.reply('Không tạo được tên gợi ý. Hãy nhập lại họ và tên đệm.');
        return;
      }
      st.randomPrefix = normalized;
      st.randomOptions = options;
      st.flow = 'random_pick';
      await ctx.reply(
        `Bạn muốn tạo VA với tên gốc ${normalized}.\nHãy chọn một trong số các tên mở rộng dưới đây:`,
        randomPickInlineKeyboard(options, Markup),
      );
      return;
    }

    if (st.flow === 'random_pick') {
      await ctx.reply('Vui lòng chọn tên bằng nút ngay trong đoạn chat ở trên.');
      return;
    }

    if (st.flow === 'random_confirm') {
      await ctx.reply('Vui lòng xác nhận bằng nút ngay trong đoạn chat ở trên.');
      return;
    }

    if (st.flow === 'withdraw_amt') {
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.reply('Mất liên kết. /lienket lại.');
        return;
      }
      const n = Number(String(text).replace(/\D/g, ''));
      if (!Number.isFinite(n) || n <= 0) {
        await ctx.reply('Số tiền không hợp lệ. Gửi lại (VD: 500000)');
        return;
      }
      st.wdAmount = Math.floor(n);
      const saved = getSavedWithdrawAccounts(u);
      if (saved.length) {
        st.flow = 'withdraw_saved_pick';
        await ctx.reply(
          `Số dư khả dụng: ${Number(u.balance || 0).toLocaleString('vi-VN')}đ\nChọn tài khoản nhận tiền:`,
          savedWithdrawInlineKeyboard(saved, Markup),
        );
      } else {
        st.flow = 'withdraw_bank';
        st.wdBankPage = 0;
        const kb = withdrawBankInlineKeyboard(0, Markup);
        await ctx.reply('🏦 Chọn ngân hàng nhận tiền (danh sách đầy đủ như trên web):', kb.markup);
      }
      return;
    }

    if (st.flow === 'withdraw_saved_pick') {
      await ctx.reply('Vui lòng chọn tài khoản đã lưu bằng nút trong đoạn chat, hoặc chọn ngân hàng khác.');
      return;
    }

    if (st.flow === 'withdraw_bank') {
      let code = text.toUpperCase().replace(/\s+/g, '');
      const matches = findIbftBanks(text, 5);
      if (matches.length === 1) {
        code = matches[0]!.code;
      } else if (matches.length > 1 && !/^[A-Z0-9]{2,10}$/.test(code)) {
        await ctx.reply(
          `Có nhiều NH khớp:\n${matches.map((m) => `• ${m.code} — ${m.name}`).join('\n')}\n\nGửi lại mã rút gọn (VD: VCB).`,
        );
        return;
      }
      if (!/^[A-Z0-9]{2,10}$/.test(code)) {
        await ctx.reply('Không xác định được mã NH. Thử mã như VCB, ICB, TCB…');
        return;
      }
      st.wdBank = code;
      st.flow = 'withdraw_acc';
      await ctx.reply(`NH: ${getIbftBankLabel(code)} (${code}). Gửi số tài khoản nhận tiền:`);
      return;
    }

    if (st.flow === 'withdraw_acc') {
      st.wdAccount = text;
      st.flow = 'withdraw_holder';
      await ctx.reply('Gửi tên chủ tài khoản (IN HOA không dấu khuyến nghị):');
      return;
    }

    if (st.flow === 'withdraw_holder') {
      const u = await linkedUser(tid);
      if (!u) {
        resetFlow(st);
        await ctx.reply('Mất liên kết. /lienket lại.');
        return;
      }
      const acc = String(st.wdAccount || '').trim();
      const bankCode = st.wdBank;
      const amount = st.wdAmount;
      resetFlow(st);
      if (!bankCode || !amount) {
        await ctx.reply('Phiên rút tiền lỗi. Bấm «Rút tiền» làm lại.', mainKeyboard(Markup));
        return;
      }
      const result = await executeWithdrawalRequest(u.id, {
        bankCode,
        bankAccount: acc,
        bankHolder: text,
        amount,
      });
      if (!result.ok) {
        await ctx.reply(`❌ ${result.error}`, mainKeyboard(Markup));
        return;
      }
      await upsertSavedWithdrawAccountForUser(u.id, bankCode, acc, text);
      await ctx.reply(
        [
          '✅ Đã tạo lệnh rút tiền',
          `Mã: ${result.id}`,
          `Thực nhận (sau phí): ${result.actualReceive.toLocaleString('vi-VN')} đ`,
          `Số dư sau: ${result.balanceAfter.toLocaleString('vi-VN')} đ`,
          '',
          'Admin sẽ xử lý trên web.',
        ].join('\n'),
        mainKeyboard(Markup),
      );
    }
  });

  bot.catch((err, ctx) => {
    console.error('Bot error', err);
    void ctx?.reply('Có lỗi xử lý. Thử lại sau.').catch(() => {});
  });

  await bot.launch();
  console.log('[Sinpay] Telegram bot đang chạy (long polling)');

  if (options.registerSignalHandlers) {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

const isCli =
  typeof process !== 'undefined' &&
  Boolean(process.argv[1]?.includes('telegram-bot') || process.argv[1]?.includes('telegram.ts'));

if (isCli) {
  startTelegramBot({ registerSignalHandlers: true, exitOnMissingToken: true }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
