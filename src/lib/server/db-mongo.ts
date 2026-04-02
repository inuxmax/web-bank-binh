import 'server-only';

import type { Model } from 'mongoose';
import type { UserRecord, VaRecord } from './db-types';
import { connectMongo } from './mongo-connection';
import {
  AppConfigModel,
  BalanceHistoryModel,
  IbftHistoryModel,
  SimRentOrderModel,
  ShopBankAccountModel,
  ShopBankSaleModel,
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
    isVerified: false,
    isActive: false,
    feePercent: null,
    ipnFeeFlat: null,
    withdrawFeeFlat: null,
    vaLimit: null,
    balance: 0,
    createdVA: 0,
    twoFactorEnabled: false,
    twoFactorCodeExpires: null,
    ctvStatus: 'none',
    adminPermissions: [],
    ctvRatePercent: null,
    ctvCustomerFeePercent: null,
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

export async function countOnlineUsers(windowMs = 120000): Promise<number> {
  await connectMongo();
  const cutoff = Date.now() - Math.max(10000, Number(windowMs) || 120000);
  return UserModel.countDocuments({
    _id: { $ne: 'admin' },
    webLastSeenAt: { $gte: cutoff },
  });
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
      minWithdrawAmount: 10000,
      ctvCommissionPercent: 1,
      globalVaLimit: null,
      autoApproveNewUsers: false,
      simRentApiToken: '',
      simRentMarkupPercent: 0,
      statsResetAt: 0,
      mongoBackupAutoEnabled: true,
      mongoBackupIntervalMinutes: 360,
      mongoBackupKeepFiles: 20,
      mongoBackupLastRunAt: 0,
    });
    return {
      globalFeePercent: 0,
      ipnFeeFlat: 4000,
      withdrawFeeFlat: 4000,
      minWithdrawAmount: 10000,
      ctvCommissionPercent: 1,
      globalVaLimit: null,
      autoApproveNewUsers: false,
      simRentApiToken: '',
      simRentMarkupPercent: 0,
      statsResetAt: 0,
      mongoBackupAutoEnabled: true,
      mongoBackupIntervalMinutes: 360,
      mongoBackupKeepFiles: 20,
      mongoBackupLastRunAt: 0,
    };
  }
  const { _id, __v, ...rest } = doc as Record<string, unknown>;
  const defaults = {
    globalFeePercent: 0,
    ipnFeeFlat: 4000,
    withdrawFeeFlat: 4000,
    minWithdrawAmount: 10000,
    ctvCommissionPercent: 1,
    globalVaLimit: null,
    autoApproveNewUsers: false,
    simRentApiToken: '',
    simRentMarkupPercent: 0,
    statsResetAt: 0,
    mongoBackupAutoEnabled: true,
    mongoBackupIntervalMinutes: 360,
    mongoBackupKeepFiles: 20,
    mongoBackupLastRunAt: 0,
  };
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
    userId: entry.userId ? String(entry.userId) : '',
    username: entry.username ? String(entry.username) : '',
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

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await connectMongo();
  const q = String(email || '').trim().toLowerCase();
  if (!q) return null;
  const doc = await UserModel.findOne({
    email: new RegExp(`^${escapeRegex(q)}$`, 'i'),
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

function normalizeTelegramUsername(v: string) {
  const raw = String(v || '').trim().replace(/^@+/, '');
  if (!raw) return '';
  return raw.replace(/[^\w]/g, '').slice(0, 64);
}

/** Gỡ telegramId khỏi mọi user đang dùng nó, rồi gán cho userId (liên kết bot). */
export async function assignTelegramToUser(
  userId: string,
  telegramId: string,
  telegramUsername?: string,
): Promise<void> {
  await connectMongo();
  const tid = String(telegramId || '').trim();
  const uid = String(userId || '').trim();
  if (!tid || !uid) return;
  await UserModel.updateMany({ telegramId: tid }, { $unset: { telegramId: 1, telegramUsername: 1 } });
  const tgUsername = normalizeTelegramUsername(String(telegramUsername || ''));
  const setData: Record<string, unknown> = { telegramId: tid };
  if (tgUsername) setData.telegramUsername = tgUsername;
  await UserModel.findByIdAndUpdate(uid, {
    $set: setData,
    $unset: { telegramLinkToken: 1, telegramLinkExpires: 1 },
  });
}

export async function clearTelegramFromUser(userId: string): Promise<void> {
  await connectMongo();
  await UserModel.findByIdAndUpdate(String(userId), {
    $unset: { telegramId: 1, telegramUsername: 1, telegramLinkToken: 1, telegramLinkExpires: 1 },
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
  telegramUsername?: string,
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
  await UserModel.updateMany({ telegramId: tid }, { $unset: { telegramId: 1, telegramUsername: 1 } });
  const tgUsername = normalizeTelegramUsername(String(telegramUsername || ''));
  const setData: Record<string, unknown> = { telegramId: tid };
  if (tgUsername) setData.telegramUsername = tgUsername;
  await UserModel.findByIdAndUpdate(userId, {
    $set: setData,
    $unset: { telegramLinkToken: 1, telegramLinkExpires: 1 },
  });
  return { ok: true };
}

export async function addShopBankAccounts(
  rows: { holderName: string; accountNumber: string; bankCode: string; price: number; uploadedBy?: string }[],
): Promise<number> {
  await connectMongo();
  if (!rows.length) return 0;
  const now = Date.now();
  const docs = rows.map((r) => ({
    holderName: String(r.holderName || '').trim(),
    accountNumber: String(r.accountNumber || '').trim(),
    bankCode: String(r.bankCode || '').trim().toUpperCase(),
    price: Math.max(0, Number(r.price) || 0),
    uploadedBy: String(r.uploadedBy || '').trim(),
    createdAt: now,
    soldAt: null,
    lockToken: null,
    lockedAt: null,
  }));
  const res = await ShopBankAccountModel.insertMany(docs as never[], { ordered: false }).catch((e: unknown) => {
    const err = e as { insertedDocs?: unknown[] };
    return err.insertedDocs || [];
  });
  return Array.isArray(res) ? res.length : 0;
}

export async function getShopBankInventoryByBank(): Promise<
  { bankCode: string; stockCount: number; minPrice: number; maxPrice: number }[]
> {
  await connectMongo();
  const rows = await ShopBankAccountModel.aggregate([
    { $match: { soldAt: null, lockToken: null } },
    {
      $group: {
        _id: '$bankCode',
        stockCount: { $sum: 1 },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    bankCode: String(r._id || '').toUpperCase(),
    stockCount: Number(r.stockCount) || 0,
    minPrice: Number(r.minPrice) || 0,
    maxPrice: Number(r.maxPrice) || 0,
  }));
}

async function pickOneRandomUnsoldByBank(bankCode: string) {
  const lockToken = `lk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sampled = await ShopBankAccountModel.aggregate([
    { $match: { bankCode: String(bankCode || '').trim().toUpperCase(), soldAt: null, lockToken: null } },
    { $sample: { size: 1 } },
    { $project: { _id: 1 } },
  ]);
  const id = sampled?.[0]?._id;
  if (!id) return null;
  const claimed = await ShopBankAccountModel.findOneAndUpdate(
    { _id: id, soldAt: null, lockToken: null },
    { $set: { lockToken, lockedAt: Date.now() } },
    { new: true },
  ).lean();
  return claimed as Record<string, unknown> | null;
}

export async function buyShopBankRandom(params: {
  userId: string;
  bankCode: string;
  quantity: number;
}): Promise<
  | { ok: true; saleId: string; quantity: number; totalAmount: number; items: Record<string, unknown>[] }
  | { ok: false; error: string }
> {
  await connectMongo();
  const userId = String(params.userId || '').trim();
  const bankCode = String(params.bankCode || '').trim().toUpperCase();
  const quantity = Math.max(1, Math.min(500, Math.floor(Number(params.quantity) || 0)));
  if (!userId || !bankCode || !quantity) return { ok: false, error: 'Dữ liệu mua không hợp lệ' };

  const picked: Record<string, unknown>[] = [];
  for (let i = 0; i < quantity; i += 1) {
    const row = await pickOneRandomUnsoldByBank(bankCode);
    if (!row) break;
    picked.push(row);
  }
  if (picked.length < quantity) {
    if (picked.length) {
      await ShopBankAccountModel.updateMany(
        { _id: { $in: picked.map((x) => x._id) }, soldAt: null },
        { $set: { lockToken: null, lockedAt: null } },
      );
    }
    return { ok: false, error: 'Không đủ tồn kho' };
  }

  const totalAmount = picked.reduce((s, x) => s + Math.max(0, Number(x.price) || 0), 0);
  const u = await getUser(userId);
  const balance = Number(u.balance) || 0;
  if (balance < totalAmount) {
    await ShopBankAccountModel.updateMany(
      { _id: { $in: picked.map((x) => x._id) }, soldAt: null },
      { $set: { lockToken: null, lockedAt: null } },
    );
    return { ok: false, error: 'Số dư không đủ để mua' };
  }

  const nextBalance = balance - totalAmount;
  const saleId = `SB${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  await updateUser(userId, { balance: nextBalance });
  await addUserBalanceHistory({
    ts: Date.now(),
    userId,
    delta: -totalAmount,
    balanceAfter: nextBalance,
    reason: 'shop_bank_buy',
    ref: saleId,
  });

  const now = Date.now();
  await ShopBankAccountModel.updateMany(
    { _id: { $in: picked.map((x) => x._id) }, soldAt: null },
    {
      $set: {
        soldAt: now,
        lockToken: null,
        lockedAt: null,
        soldToUserId: userId,
        saleId,
      },
    },
  );
  await ShopBankSaleModel.create({
    saleId,
    userId,
    bankCode,
    quantity,
    totalAmount,
    accountIds: picked.map((x) => String(x._id)),
    createdAt: now,
  });
  return { ok: true, saleId, quantity, totalAmount, items: picked };
}

export async function getShopBankSalesByUser(
  userId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const uid = String(userId || '').trim();
  if (!uid) return [];
  const n = Math.max(1, Math.min(200, Number(limit) || 50));
  const sales = await ShopBankSaleModel.find({ userId: uid }).sort({ createdAt: -1 }).limit(n).lean();
  const saleIds = sales.map((s) => String((s as { saleId?: string }).saleId || '')).filter(Boolean);
  const accounts = await ShopBankAccountModel.find({ saleId: { $in: saleIds } }).lean();
  const bySale = new Map<string, Record<string, unknown>[]>();
  for (const a of accounts as Record<string, unknown>[]) {
    const sid = String(a.saleId || '');
    if (!bySale.has(sid)) bySale.set(sid, []);
    bySale.get(sid)!.push({
      holderName: String(a.holderName || ''),
      accountNumber: String(a.accountNumber || ''),
      bankCode: String(a.bankCode || ''),
      price: Number(a.price) || 0,
    });
  }
  return sales.map((s) => {
    const row = s as Record<string, unknown>;
    const sid = String(row.saleId || '');
    return {
      saleId: sid,
      bankCode: String(row.bankCode || ''),
      quantity: Number(row.quantity) || 0,
      totalAmount: Number(row.totalAmount) || 0,
      createdAt: Number(row.createdAt) || 0,
      items: bySale.get(sid) || [],
    };
  });
}

export async function getShopBankRevenue(
  fromTs: number,
  toTs: number,
): Promise<{ soldCount: number; revenue: number }> {
  await connectMongo();
  const rows = await ShopBankSaleModel.aggregate([
    { $match: { createdAt: { $gte: Number(fromTs) || 0, $lte: Number(toTs) || Date.now() } } },
    {
      $group: {
        _id: null,
        soldCount: { $sum: '$quantity' },
        revenue: { $sum: '$totalAmount' },
      },
    },
  ]);
  const x = rows?.[0] || {};
  return {
    soldCount: Number(x.soldCount) || 0,
    revenue: Number(x.revenue) || 0,
  };
}

export async function addSimRentOrder(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  await connectMongo();
  const now = Date.now();
  const orderId = String(entry.orderId || `SRO${now}${Math.floor(100 + Math.random() * 900)}`);
  const row = {
    orderId,
    userId: String(entry.userId || ''),
    serviceId: String(entry.serviceId || ''),
    serviceName: String(entry.serviceName || ''),
    network: String(entry.network || ''),
    prefixs: String(entry.prefixs || ''),
    excludePrefixs: String(entry.excludePrefixs || ''),
    number: String(entry.number || ''),
    rentId: String(entry.rentId || ''),
    status: String(entry.status || 'PENDING'),
    otp: String(entry.otp || ''),
    smsContent: String(entry.smsContent || ''),
    basePrice: Number(entry.basePrice || 0),
    price: Number(entry.price || 0),
    markupPercent: Number(entry.markupPercent || 0),
    isSentSms: Boolean(entry.isSentSms),
    statusDescription: String(entry.statusDescription || ''),
    createdAt: Number(entry.createdAt || now),
    updatedAt: Number(entry.updatedAt || now),
    providerRaw: entry.providerRaw || null,
  };
  await SimRentOrderModel.create(row);
  return row;
}

export async function updateSimRentOrderByRentId(
  userId: string,
  rentId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  await connectMongo();
  const uid = String(userId || '').trim();
  const rid = String(rentId || '').trim();
  if (!uid || !rid) return null;
  const row = await SimRentOrderModel.findOneAndUpdate(
    { userId: uid, rentId: rid },
    { $set: { ...patch, updatedAt: Date.now() } },
    { new: true },
  ).lean();
  if (!row) return null;
  const { _id, __v, ...rest } = row as Record<string, unknown>;
  return rest;
}

export async function getSimRentOrdersByUser(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const uid = String(userId || '').trim();
  if (!uid) return [];
  const n = Math.max(1, Math.min(100, Number(limit) || 20));
  const off = Math.max(0, Number(offset) || 0);
  const rows = await SimRentOrderModel.find({ userId: uid }).sort({ createdAt: -1 }).skip(off).limit(n).lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function countSimRentOrdersByUser(userId: string): Promise<number> {
  await connectMongo();
  const uid = String(userId || '').trim();
  if (!uid) return 0;
  return SimRentOrderModel.countDocuments({ userId: uid });
}

export async function loadSimRentOrders(): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const rows = await SimRentOrderModel.find().lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

export async function getPendingSimRentOrdersByUser(
  userId: string,
  limit = 10,
): Promise<Record<string, unknown>[]> {
  await connectMongo();
  const uid = String(userId || '').trim();
  if (!uid) return [];
  const n = Math.max(1, Math.min(50, Number(limit) || 10));
  const rows = await SimRentOrderModel.find({
    userId: uid,
    status: { $in: ['PENDING', 'PROCESSING', 'WAITING'] },
  })
    .sort({ createdAt: -1 })
    .limit(n)
    .lean();
  return rows.map((r) => {
    const { _id, __v, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}
