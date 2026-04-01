import 'server-only';

import type { Model } from 'mongoose';
import type { UserRecord, VaRecord } from './db-types';
import { connectMongo } from './mongo-connection';
import {
  AppConfigModel,
  BalanceHistoryModel,
  IbftHistoryModel,
  UserBalanceHistoryModel,
  UserModel,
  VaRecordModel,
  WithdrawalModel,
} from './mongo-models';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultUserRecord(id: string): UserRecord {
  return {
    id,
    username: '',
    fullName: '',
    phone: '',
    spamMutedUntil: 0,
    spamReason: '',
    isBanned: false,
    isActive: false,
    feePercent: null,
    ipnFeeFlat: null,
    withdrawFeeFlat: null,
    vaLimit: null,
    balance: 0,
    createdVA: 0,
    ctvStatus: 'none',
    adminPermissions: [],
    ctvRatePercent: null,
    ctvCommissionTotal: 0,
    ctvCommissionCount: 0,
  };
}

function docToUser(doc: Record<string, unknown>): UserRecord {
  const id = String(doc._id ?? '');
  const { _id, __v, ...rest } = doc;
  return {
    ...defaultUserRecord(id),
    ...rest,
    id,
  } as UserRecord;
}

async function trimCollection(M: Model<{ ts?: number }>, max: number) {
  const count = await M.countDocuments();
  if (count <= max) return;
  const excess = count - max;
  const oldest = await M.find().sort({ ts: 1 }).limit(excess).select('_id').lean();
  await M.deleteMany({ _id: { $in: oldest.map((o) => o._id) } });
}

export async function loadAll(): Promise<VaRecord[]> {
  await connectMongo();
  const rows = await VaRecordModel.find().lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest as VaRecord;
  });
}

export async function saveAll(arr: VaRecord[]): Promise<void> {
  await connectMongo();
  await VaRecordModel.deleteMany({});
  if (arr.length) await VaRecordModel.insertMany(arr as never[]);
}

export async function upsert(record: VaRecord): Promise<VaRecord> {
  await connectMongo();
  const rid = String(record.requestId || '');
  await VaRecordModel.findOneAndUpdate(
    { requestId: rid },
    { $set: { ...record, requestId: rid } },
    { upsert: true, new: true },
  );
  return record;
}

export async function getByRequestId(requestId: string): Promise<VaRecord | null> {
  await connectMongo();
  const r = await VaRecordModel.findOne({ requestId: String(requestId) }).lean();
  if (!r) return null;
  const { _id, __v, ...rest } = r as Record<string, unknown>;
  return rest as VaRecord;
}

export async function loadWithdrawals(): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const rows = await WithdrawalModel.find().lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return { ...rest, mongoId: String(_id || '') };
  });
}

export async function saveWithdrawals(arr: Record<string, unknown>[]): Promise<void> {
  await connectMongo();
  await WithdrawalModel.deleteMany({});
  if (arr.length) await WithdrawalModel.insertMany(arr as never[]);
}

export async function addWithdrawal(record: Record<string, unknown>): Promise<Record<string, unknown>> {
  await connectMongo();
  await WithdrawalModel.create(record);
  return record;
}

export async function getWithdrawals({
  status,
  limit,
}: { status?: string; limit?: number } = {}): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const q = status ? { status } : {};
  let cur = WithdrawalModel.find(q).sort({ createdAt: -1 });
  if (limit && Number(limit) > 0) cur = cur.limit(Number(limit));
  const rows = await cur.lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return { ...rest, mongoId: String(_id || '') };
  });
}

export async function updateWithdrawalStatus(
  id: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  await connectMongo();
  const patch = { status, updatedAt: Date.now(), ...(extra || {}) };
  const w = await WithdrawalModel.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean();
  if (!w) return null;
  const { _id, __v, ...rest } = w as Record<string, unknown>;
  return { ...rest, mongoId: String(_id || '') };
}

export async function updateWithdrawalStatusByMongoId(
  mongoId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  await connectMongo();
  const patch = { status, updatedAt: Date.now(), ...(extra || {}) };
  const w = await WithdrawalModel.findByIdAndUpdate(String(mongoId), { $set: patch }, { new: true }).lean();
  if (!w) return null;
  const { _id, __v, ...rest } = w as Record<string, unknown>;
  return { ...rest, mongoId: String(_id || '') };
}

export async function getWithdrawalById(id: string): Promise<Record<string, unknown> | null> {
  await connectMongo();
  const candidates = [id, id.startsWith('WD') ? id : `WD${id}`, id.replace(/^WD/i, '')];
  const uniq = [...new Set(candidates)];
  for (const c of uniq) {
    const w = await WithdrawalModel.findOne({ id: c }).lean();
    if (w) {
      const { _id, __v, ...rest } = w as Record<string, unknown>;
      return { ...rest, mongoId: String(_id || '') };
    }
  }
  return null;
}

export async function getWithdrawalByMongoId(mongoId: string): Promise<Record<string, unknown> | null> {
  await connectMongo();
  const w = await WithdrawalModel.findById(String(mongoId)).lean();
  if (!w) return null;
  const { _id, __v, ...rest } = w as Record<string, unknown>;
  return { ...rest, mongoId: String(_id || '') };
}

export async function getUser(id: string | number): Promise<UserRecord> {
  await connectMongo();
  const key = String(id);
  let doc = await UserModel.findById(key).lean();
  if (!doc) {
    await UserModel.create({ _id: key, ...defaultUserRecord(key) });
    doc = await UserModel.findById(key).lean();
  }
  return docToUser(doc! as Record<string, unknown>);
}

export async function findUser(id: string | number): Promise<UserRecord | null> {
  await connectMongo();
  const doc = await UserModel.findById(String(id)).lean();
  if (!doc) return null;
  return docToUser(doc as Record<string, unknown>);
}

export async function updateUser(id: string | number, data: Partial<UserRecord>): Promise<UserRecord> {
  await connectMongo();
  const key = String(id);
  const update = { ...data };
  delete (update as { id?: string }).id;
  if (update.balance !== undefined && update.balance < 0) update.balance = 0;
  const prev = await UserModel.findById(key).lean();
  if (prev) {
    const prevCode = String((prev as { ctvCode?: string }).ctvCode || '').trim();
    const nextCode = String((update as { ctvCode?: string }).ctvCode || '').trim();
    // Keep share code stable once it is assigned.
    if (prevCode) {
      delete (update as { ctvCode?: string }).ctvCode;
    } else if (!nextCode) {
      delete (update as { ctvCode?: string }).ctvCode;
    } else {
      (update as { ctvCode?: string }).ctvCode = nextCode.toUpperCase();
    }
  } else if ((update as { ctvCode?: string }).ctvCode) {
    (update as { ctvCode?: string }).ctvCode = String(
      (update as { ctvCode?: string }).ctvCode,
    ).trim().toUpperCase();
  }
  if (!prev) {
    await UserModel.create({ _id: key, ...defaultUserRecord(key), ...update });
  } else {
    await UserModel.findByIdAndUpdate(key, { $set: update }, { new: true });
  }
  return getUser(key);
}

export async function getAllUsers(): Promise<UserRecord[]> {
  await connectMongo();
  const rows = await UserModel.find().lean();
  return rows.map((d) => docToUser(d as Record<string, unknown>));
}

export async function getConfig(): Promise<Record<string, unknown>> {
  await connectMongo();
  const doc = await AppConfigModel.findById('global').lean();
  if (!doc) {
    await AppConfigModel.create({
      _id: 'global',
      globalFeePercent: 0,
      ipnFeeFlat: 4000,
      withdrawFeeFlat: 4000,
      ctvCommissionPercent: 1,
    });
    return { globalFeePercent: 0, ipnFeeFlat: 4000, withdrawFeeFlat: 4000, ctvCommissionPercent: 1 };
  }
  const { _id, __v, ...rest } = doc as Record<string, unknown>;
  const defaults = { globalFeePercent: 0, ipnFeeFlat: 4000, withdrawFeeFlat: 4000, ctvCommissionPercent: 1 };
  return { ...defaults, ...rest };
}

export async function updateConfig(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  await connectMongo();
  await AppConfigModel.findByIdAndUpdate('global', { $set: data }, { upsert: true, new: true });
  return getConfig();
}

export async function saveIbftHistory(arr: unknown[]): Promise<void> {
  await connectMongo();
  await IbftHistoryModel.deleteMany({});
  if (arr.length) await IbftHistoryModel.insertMany(arr as never[]);
}

export async function addIbftHistory(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  await connectMongo();
  const row = {
    ts: Number(entry.ts) || Date.now(),
    adminId: entry.adminId ? String(entry.adminId) : '',
    merchant: entry.merchant ? String(entry.merchant) : '',
    bankCode: entry.bankCode ? String(entry.bankCode) : '',
    accountNumber: entry.accountNumber ? String(entry.accountNumber) : '',
    accountName: entry.accountName ? String(entry.accountName) : '',
    amount: Number(entry.amount) || 0,
    remark: entry.remark ? String(entry.remark) : '',
    orderId: entry.orderId ? String(entry.orderId) : '',
    tranStatus: entry.tranStatus ? String(entry.tranStatus) : '',
    errorCode: entry.errorCode ? String(entry.errorCode) : '',
    errorMessage: entry.errorMessage ? String(entry.errorMessage) : '',
  };
  await IbftHistoryModel.create(row);
  await trimCollection(IbftHistoryModel, 500);
  return row;
}

export async function getIbftHistory(limit = 20): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const n = Math.max(1, Math.min(200, Number(limit) || 20));
  const rows = await IbftHistoryModel.find().sort({ ts: -1 }).limit(n).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function getAllIbftHistory(): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const rows = await IbftHistoryModel.find().sort({ ts: -1 }).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function dumpBalanceHistories(): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const rows = await BalanceHistoryModel.find().sort({ ts: -1 }).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function dumpUserBalanceHistories(): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const rows = await UserBalanceHistoryModel.find().sort({ ts: -1 }).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function addBalanceHistory(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  await connectMongo();
  const row = {
    ts: Number(entry.ts) || Date.now(),
    balance: Number(entry.balance) || 0,
    balanceRaw: entry.balanceRaw ? String(entry.balanceRaw) : '',
    source: entry.source ? String(entry.source) : '',
    adminId: entry.adminId ? String(entry.adminId) : '',
  };
  await BalanceHistoryModel.create(row);
  await trimCollection(BalanceHistoryModel, 500);
  return row;
}

export async function getBalanceHistory(limit = 50): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const n = Math.max(1, Math.min(200, Number(limit) || 50));
  const rows = await BalanceHistoryModel.find().sort({ ts: -1 }).limit(n).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function addUserBalanceHistory(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  await connectMongo();
  const row = {
    ts: Number(entry.ts) || Date.now(),
    userId: entry.userId ? String(entry.userId) : '',
    delta: Number(entry.delta) || 0,
    balanceAfter: Number(entry.balanceAfter) || 0,
    reason: entry.reason ? String(entry.reason) : '',
    ref: entry.ref ? String(entry.ref) : '',
  };
  await UserBalanceHistoryModel.create(row);
  await trimCollection(UserBalanceHistoryModel, 3000);
  return row;
}

export async function getUserBalanceHistory(userId: string, limit = 30): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const uid = String(userId || '').trim();
  const n = Math.max(1, Math.min(200, Number(limit) || 30));
  const rows = await UserBalanceHistoryModel.find({ userId: uid }).sort({ ts: -1 }).limit(n).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function getVAsByUser(userId: string, limit = 10): Promise<VaRecord[]> {
  await connectMongo();
  const uid = String(userId);
  const rows = await VaRecordModel.find({ userId: uid })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest as VaRecord;
  });
}

export async function findUserByWebLogin(login: string): Promise<UserRecord | null> {
  await connectMongo();
  const q = String(login || '').trim().toLowerCase();
  if (!q) return null;
  const doc = await UserModel.findOne({
    webLogin: new RegExp(`^${escapeRegex(q)}$`, 'i'),
  }).lean();
  if (!doc) return null;
  return docToUser(doc as Record<string, unknown>);
}

export async function findUserByCtvCode(code: string): Promise<UserRecord | null> {
  await connectMongo();
  const q = String(code || '').trim().toUpperCase();
  if (!q) return null;
  const doc = await UserModel.findOne({
    ctvCode: new RegExp(`^${escapeRegex(q)}$`, 'i'),
  }).lean();
  if (!doc) return null;
  return docToUser(doc as Record<string, unknown>);
}

export async function findUserByTelegramId(telegramId: string): Promise<UserRecord | null> {
  await connectMongo();
  const tid = String(telegramId || '').trim();
  if (!tid) return null;
  const doc = await UserModel.findOne({ telegramId: tid }).lean();
  if (!doc) return null;
  return docToUser(doc as Record<string, unknown>);
}

/** Gỡ telegramId khỏi mọi user đang dùng nó, rồi gán cho userId (liên kết bot). */
export async function assignTelegramToUser(userId: string, telegramId: string): Promise<void> {
  await connectMongo();
  const tid = String(telegramId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid || !uid) return;
  await UserModel.updateMany({ telegramId: tid }, { $unset: { telegramId: 1 } });
  await UserModel.findByIdAndUpdate(uid, {
    $set: { telegramId: tid },
    $unset: { telegramLinkToken: 1, telegramLinkExpires: 1 },
  });
}

export async function clearTelegramFromUser(userId: string): Promise<void> {
  await connectMongo();
  await UserModel.findByIdAndUpdate(String(userId), {
    $unset: { telegramId: 1, telegramLinkToken: 1, telegramLinkExpires: 1 },
  });
}

export async function setTelegramLinkOffer(userId: string, token: string, expiresAt: number): Promise<void> {
  await connectMongo();
  await UserModel.findByIdAndUpdate(String(userId), {
    $set: { telegramLinkToken: token, telegramLinkExpires: expiresAt },
  });
}

export async function redeemTelegramDeepLink(
  token: string,
  telegramUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await connectMongo();
  const t = String(token || '').trim();
  const tid = String(telegramUserId || '').trim();
  if (!t || !tid) {
    return { ok: false, error: 'Thiếu mã hoặc tài khoản Telegram.' };
  }
  const now = Date.now();
  const doc = await UserModel.findOne({
    telegramLinkToken: t,
    telegramLinkExpires: { $gt: now },
  }).lean();
  if (!doc) {
    return { ok: false, error: 'Liên kết hết hạn hoặc không hợp lệ. Tạo liên kết mới trên web.' };
  }
  const rawDoc = doc as Record<string, unknown>;
  const userId = String(rawDoc._id ?? '');
  const u = docToUser(rawDoc);
  if (u.isBanned === true) {
    return { ok: false, error: 'Tài khoản đã bị khóa.' };
  }
  await UserModel.updateMany({ telegramId: tid }, { $unset: { telegramId: 1 } });
  await UserModel.findByIdAndUpdate(userId, {
    $set: { telegramId: tid },
    $unset: { telegramLinkToken: 1, telegramLinkExpires: 1 },
  });
  return { ok: true };
}
