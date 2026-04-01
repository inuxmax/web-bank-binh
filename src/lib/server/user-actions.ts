/**
 * Logic tạo VA / rút tiền dùng chung cho API web và Telegram bot.
 */
import 'server-only';

import { z } from 'zod';
import * as db from '@/lib/server/db';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';
import { createVirtualAccount, getBankOverrides, hpaySignatureHint } from '@/lib/server/hpay';
import { getIbftBankLabel } from '@/lib/banks';
import { buildWithdrawCreatedText, notifyAdminsTelegram, notifyUserTelegramByUserId } from './notify';

function getRuntimeRequire(): NodeRequire {
  if (typeof __non_webpack_require__ !== 'undefined') return __non_webpack_require__;
  return Function('return require')() as NodeRequire;
}

function randomHex(bytes: number): string {
  const crypto = getRuntimeRequire()('crypto') as typeof import('crypto');
  return crypto.randomBytes(bytes).toString('hex').toUpperCase();
}

const vaSchema = z.object({
  name: z.string().min(2).max(50),
  bankCode: z.string().max(10).optional(),
  remark: z.string().max(50).optional(),
});

const withdrawSchema = z.object({
  bankCode: z.string().min(2).max(15),
  bankAccount: z.string().min(6),
  bankHolder: z.string().min(2),
  amount: z.number().int().positive(),
});

export type CreateVaResult =
  | {
      ok: true;
      requestId: string;
      decoded: Record<string, unknown>;
      raw: Record<string, unknown>;
    }
  | { ok: false; error: string; code?: string; hint?: string; status?: number };

/**
 * Tạo VA cho ownerId. isAdminContext: true thì bỏ qua isActive và giới hạn VA (giống admin trên web).
 */
export async function createVirtualAccountForOwner(
  ownerId: string,
  rawName: string,
  opts: { bankCode?: string; remark?: string; isAdminContext?: boolean } = {},
): Promise<CreateVaResult> {
  try {
    const { name, bankCode: rawBank, remark: remarkInput } = vaSchema.parse({
      name: rawName,
      bankCode: opts.bankCode,
      remark: opts.remark,
    });
    const subject = await db.getUser(ownerId);
    if (isUserBanned(subject)) {
      return { ok: false, error: USER_BANNED_MESSAGE, status: 403 };
    }
    if (!opts.isAdminContext) {
      if (!subject.isActive) {
        return { ok: false, error: 'Tài khoản chưa được duyệt', status: 403 };
      }
      const cfg = await db.getConfig();
      const globalVaLimitRaw = Number((cfg as { globalVaLimit?: number | null }).globalVaLimit);
      const globalVaLimit = Number.isFinite(globalVaLimitRaw) && globalVaLimitRaw > 0 ? globalVaLimitRaw : null;
      const effectiveVaLimit =
        subject.vaLimit !== null && subject.vaLimit !== undefined ? Number(subject.vaLimit) : globalVaLimit;
      if (effectiveVaLimit !== null && Number(subject.createdVA) >= Number(effectiveVaLimit)) {
        return {
          ok: false,
          error: `Đã đạt giới hạn tạo VA (${effectiveVaLimit})`,
          status: 400,
        };
      }
    }

    const bankRaw = String(rawBank || '').trim().toUpperCase();
    const bankCode =
      bankRaw === '' ? undefined : ['MSB', 'KLB', 'BIDV'].includes(bankRaw) ? bankRaw : undefined;
    if (bankRaw !== '' && !bankCode) {
      return {
        ok: false,
        error: 'bankCode chỉ hỗ trợ MSB, KLB, BIDV hoặc để trống',
        status: 400,
      };
    }

    const safeName = name.trim().replace(/\s+/g, ' ').slice(0, 50);
    const apiName = safeName;

    const requestId = `${Date.now().toString().slice(-10)}${Math.floor(100000 + Math.random() * 900000)}`.slice(
      0,
      20,
    );
    let remark = String(remarkInput || '').trim();
    remark = remark
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]+/g, ' ')
      .replace(/\b(?:HPAY|HTP)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    remark = remark.slice(0, 50);

    const ov = getBankOverrides(bankCode);
    const { decoded, raw, requestId: rid } = await createVirtualAccount({
      requestId,
      vaName: apiName,
      vaType: bankCode === 'BIDV' ? '1' : '2',
      vaCondition: '2',
      remark,
      bankCode,
      merchantIdOverride: ov.midOverride,
      passcodeOverride: ov.passOverride,
      clientIdOverride: ov.clientIdOverride,
      clientSecretOverride: ov.clientSecretOverride,
      xApiMidOverride: ov.xApiMidOverride,
    });

    await db.upsert({
      requestId: rid,
      userId: ownerId,
      status: 'unpaid',
      remark,
      name: safeName,
      createdAt: Date.now(),
    });

    if (!decoded) {
      return {
        ok: false,
        error: String(raw.errorMessage || 'Tạo VA thất bại'),
        code: raw.errorCode != null ? String(raw.errorCode) : undefined,
        hint: hpaySignatureHint(raw),
        status: 422,
      };
    }

    const owner = await db.getUser(ownerId);
    await db.updateUser(ownerId, { createdVA: owner.createdVA + 1 });
    await db.upsert({
      requestId: rid,
      status: 'unpaid',
      remark,
      name: safeName,
      vaAccount: decoded.vaAccount,
      vaBank: decoded.vaBank,
      vaAmount: decoded.vaAmount,
      vaType: decoded.vaType,
      vaCondition: decoded.vaCondition,
      expiredTime: decoded.expiredTime,
      quickLink: decoded.quickLink,
      qrCode: decoded.qrCode,
      userId: ownerId,
    });

    return { ok: true, requestId: rid, decoded: decoded as unknown as Record<string, unknown>, raw };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: 'Dữ liệu không hợp lệ', status: 400 };
    }
    return { ok: false, error: (e as Error).message, status: 500 };
  }
}

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

type SavedWithdrawAccount = {
  bankCode: string;
  bankAccount: string;
  bankHolder: string;
  updatedAt: number;
};

function normalizeSavedWithdrawAccounts(raw: unknown): SavedWithdrawAccount[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        bankCode: String(row.bankCode || '').trim().toUpperCase(),
        bankAccount: normalizeWdBankAccount(String(row.bankAccount || '')),
        bankHolder: normalizeWdBankHolder(String(row.bankHolder || '')),
        updatedAt: Number(row.updatedAt) || 0,
      };
    })
    .filter((r) => r.bankCode && r.bankAccount.length >= 6 && r.bankHolder);
}

async function saveWithdrawAccountForUser(
  userId: string,
  bankCode: string,
  bankAccount: string,
  bankHolder: string,
): Promise<void> {
  const user = await db.getUser(userId);
  const current = normalizeSavedWithdrawAccounts(user.savedWithdrawAccounts);
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

export type WithdrawResult =
  | {
      ok: true;
      id: string;
      feeFlat: number;
      feePercent: unknown;
      actualReceive: number;
      balanceAfter: number;
    }
  | { ok: false; error: string; status?: number };

export async function executeWithdrawalRequest(
  userId: string,
  body: unknown,
): Promise<WithdrawResult> {
  try {
    const parsed = withdrawSchema.parse(body);
    const u = await db.getUser(userId);
    if (isUserBanned(u)) {
      return { ok: false, error: USER_BANNED_MESSAGE, status: 403 };
    }
    if (!u.isActive) {
      return { ok: false, error: 'Tài khoản chưa được duyệt', status: 403 };
    }

    const user = await db.getUser(userId);
    const balanceBefore = Number(user.balance) || 0;

    if (parsed.amount > balanceBefore) {
      return {
        ok: false,
        error: `Số dư không đủ (${balanceBefore.toLocaleString('vi-VN')}đ)`,
        status: 400,
      };
    }

    const bankAccount = normalizeWdBankAccount(parsed.bankAccount);
    const bankHolder = normalizeWdBankHolder(parsed.bankHolder);
    if (!bankAccount || bankAccount.length < 6) {
      return { ok: false, error: 'Số tài khoản không hợp lệ', status: 400 };
    }
    if (!bankHolder) {
      return { ok: false, error: 'Tên chủ tài khoản không hợp lệ', status: 400 };
    }

    const config = await db.getConfig();
    let feeFlat = Math.max(
      0,
      Number(
        (config as { withdrawFeeFlat?: number }).withdrawFeeFlat ??
          (config as { ipnFeeFlat?: number }).ipnFeeFlat ??
          0,
      ) || 0,
    );
    const userFeeFlat =
      user.withdrawFeeFlat !== null && user.withdrawFeeFlat !== undefined
        ? Number(user.withdrawFeeFlat)
        : NaN;
    if (Number.isFinite(userFeeFlat) && userFeeFlat >= 0) feeFlat = userFeeFlat;
    const feePercent =
      user.feePercent !== null ? user.feePercent : (config as { globalFeePercent?: number }).globalFeePercent;
    const feeByPercent = Math.floor((parsed.amount * Number(feePercent || 0)) / 100);
    const actualReceive = Math.max(0, parsed.amount - feeFlat - feeByPercent);

    const id = `${Date.now().toString().slice(-10)}${Math.floor(100000 + Math.random() * 900000)}`;
    const balanceAfter = balanceBefore - parsed.amount;
    await db.updateUser(userId, { balance: balanceAfter });
    await db.addUserBalanceHistory({
      ts: Date.now(),
      userId,
      delta: -parsed.amount,
      balanceAfter,
      reason: 'withdraw_create',
      ref: id,
    });

    const bankName = getIbftBankLabel(parsed.bankCode);
    await db.addWithdrawal({
      id,
      userId,
      username: user.webLogin || user.username || '',
      method: 'bank',
      bankCode: parsed.bankCode,
      bankName,
      bankAccount,
      bankHolder,
      amount: parsed.amount,
      feeFlat,
      feePercent,
      feeByPercent,
      actualReceive,
      balanceBefore,
      balanceAfter,
      createdAt: Date.now(),
      status: 'pending',
    });
    await saveWithdrawAccountForUser(userId, parsed.bankCode, bankAccount, bankHolder);

    const adminMsg = [
      '🆕 YÊU CẦU RÚT TIỀN MỚI',
      `ID: ${id}`,
      `User: ${user.webLogin || user.username || userId}`,
      `User ID: ${userId}`,
      `Số dư user: ${balanceBefore.toLocaleString('vi-VN')}đ`,
      '',
      `Ngân hàng: ${bankName}`,
      `STK: ${bankAccount}`,
      `Chủ TK: ${bankHolder}`,
      '',
      `Số tiền rút: ${parsed.amount.toLocaleString('vi-VN')}đ`,
      `Phí chuyển: ${feeFlat.toLocaleString('vi-VN')}đ`,
      `Phí rút: ${feeByPercent.toLocaleString('vi-VN')}đ`,
      `Thực nhận: ${actualReceive.toLocaleString('vi-VN')}đ`,
    ].join('\n');
    await notifyAdminsTelegram(adminMsg);

    await notifyUserTelegramByUserId(
      userId,
      buildWithdrawCreatedText({
        id,
        amount: parsed.amount,
        feeFlat,
        feeByPercent,
        actualReceive,
        bankName,
        bankAccount,
        bankHolder,
        balanceAfter,
      }),
    );

    return {
      ok: true,
      id,
      feeFlat,
      feePercent,
      actualReceive,
      balanceAfter,
    };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { ok: false, error: 'Dữ liệu không hợp lệ', status: 400 };
    }
    return { ok: false, error: (e as Error).message, status: 500 };
  }
}
