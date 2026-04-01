/**
 * Lưu trữ: chỉ MongoDB. Cần MONGODB_URI (xem .env.example).
 */
import 'server-only';

import type { UserRecord, VaRecord } from './db-types';
import * as mongo from './db-mongo';

export type { UserRecord, VaRecord } from './db-types';

export async function loadAll(): Promise<VaRecord[]> {
  return mongo.loadAll();
}

export async function saveAll(arr: VaRecord[]): Promise<void> {
  return mongo.saveAll(arr);
}

export async function upsert(record: VaRecord): Promise<VaRecord> {
  return mongo.upsert(record);
}

export async function getByRequestId(requestId: string): Promise<VaRecord | null> {
  return mongo.getByRequestId(requestId);
}

export async function loadWithdrawals(): Promise<Record<string, unknown>[]> {
  return mongo.loadWithdrawals();
}

export async function saveWithdrawals(arr: Record<string, unknown>[]): Promise<void> {
  return mongo.saveWithdrawals(arr);
}

export async function addWithdrawal(record: Record<string, unknown>): Promise<Record<string, unknown>> {
  return mongo.addWithdrawal(record);
}

export async function getWithdrawals(params?: { status?: string; limit?: number }): Promise<Record<string, unknown>[]> {
  return mongo.getWithdrawals(params);
}

export async function updateWithdrawalStatus(
  id: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  return mongo.updateWithdrawalStatus(id, status, extra);
}

export async function updateWithdrawalStatusByMongoId(
  mongoId: string,
  status: string,
  extra?: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  return mongo.updateWithdrawalStatusByMongoId(mongoId, status, extra);
}

export async function getWithdrawalById(id: string): Promise<Record<string, unknown> | null> {
  return mongo.getWithdrawalById(id);
}

export async function getWithdrawalByMongoId(mongoId: string): Promise<Record<string, unknown> | null> {
  return mongo.getWithdrawalByMongoId(mongoId);
}

export async function loadUsers(): Promise<Record<string, UserRecord>> {
  const users = await mongo.getAllUsers();
  const map: Record<string, UserRecord> = {};
  for (const u of users) map[u.id] = u;
  return map;
}

export async function saveUsers(data: Record<string, UserRecord>): Promise<void> {
  for (const u of Object.values(data)) {
    await mongo.updateUser(u.id, u);
  }
}

export async function getUser(id: string | number): Promise<UserRecord> {
  return mongo.getUser(id);
}

export async function findUser(id: string | number): Promise<UserRecord | null> {
  return mongo.findUser(id);
}

export async function updateUser(id: string | number, data: Partial<UserRecord>): Promise<UserRecord> {
  return mongo.updateUser(id, data);
}

export async function getAllUsers(): Promise<UserRecord[]> {
  return mongo.getAllUsers();
}

export async function countOnlineUsers(windowMs?: number): Promise<number> {
  return mongo.countOnlineUsers(windowMs);
}

export async function getConfig(): Promise<Record<string, unknown>> {
  return mongo.getConfig();
}

export async function updateConfig(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return mongo.updateConfig(data);
}

export async function loadIbftHistory(): Promise<unknown[]> {
  return mongo.getAllIbftHistory();
}

export async function saveIbftHistory(arr: unknown[]): Promise<void> {
  return mongo.saveIbftHistory(arr);
}

export async function addIbftHistory(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  return mongo.addIbftHistory(entry);
}

export async function getIbftHistory(limit?: number): Promise<Record<string, unknown>[]> {
  return mongo.getIbftHistory(limit);
}

export async function getAllIbftHistory(): Promise<Record<string, unknown>[]> {
  return mongo.getAllIbftHistory();
}

export async function loadBalanceHistory(): Promise<unknown[]> {
  return mongo.dumpBalanceHistories();
}

export async function saveBalanceHistory(arr: unknown[]): Promise<void> {
  const { connectMongo } = await import('./mongo-connection');
  const { BalanceHistoryModel } = await import('./mongo-models');
  await connectMongo();
  await BalanceHistoryModel.deleteMany({});
  if (arr.length) await BalanceHistoryModel.insertMany(arr as never[]);
}

export async function addBalanceHistory(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  return mongo.addBalanceHistory(entry);
}

export async function getBalanceHistory(limit?: number): Promise<Record<string, unknown>[]> {
  return mongo.getBalanceHistory(limit);
}

export async function loadUserBalanceHistory(): Promise<unknown[]> {
  return mongo.dumpUserBalanceHistories();
}

export async function saveUserBalanceHistory(arr: unknown[]): Promise<void> {
  const { connectMongo } = await import('./mongo-connection');
  const { UserBalanceHistoryModel } = await import('./mongo-models');
  await connectMongo();
  await UserBalanceHistoryModel.deleteMany({});
  if (arr.length) await UserBalanceHistoryModel.insertMany(arr as never[]);
}

export async function addUserBalanceHistory(entry: Record<string, unknown>): Promise<Record<string, unknown>> {
  return mongo.addUserBalanceHistory(entry);
}

export async function getUserBalanceHistory(userId: string, limit?: number): Promise<Record<string, unknown>[]> {
  return mongo.getUserBalanceHistory(userId, limit);
}

export async function getVAsByUser(userId: string, limit?: number): Promise<VaRecord[]> {
  return mongo.getVAsByUser(userId, limit);
}

export async function findUserByWebLogin(login: string): Promise<UserRecord | null> {
  return mongo.findUserByWebLogin(login);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return mongo.findUserByEmail(email);
}

export async function findUserByCtvCode(code: string): Promise<UserRecord | null> {
  return mongo.findUserByCtvCode(code);
}

export async function findUserByTelegramId(telegramId: string): Promise<UserRecord | null> {
  return mongo.findUserByTelegramId(telegramId);
}

export async function assignTelegramToUser(
  userId: string,
  telegramId: string,
  telegramUsername?: string,
): Promise<void> {
  return mongo.assignTelegramToUser(userId, telegramId, telegramUsername);
}

export async function clearTelegramFromUser(userId: string): Promise<void> {
  return mongo.clearTelegramFromUser(userId);
}

export async function setTelegramLinkOffer(userId: string, token: string, expiresAt: number): Promise<void> {
  return mongo.setTelegramLinkOffer(userId, token, expiresAt);
}

export async function redeemTelegramDeepLink(
  token: string,
  telegramUserId: string,
  telegramUsername?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return mongo.redeemTelegramDeepLink(token, telegramUserId, telegramUsername);
}

export async function addShopBankAccounts(
  rows: { holderName: string; accountNumber: string; bankCode: string; price: number; uploadedBy?: string }[],
): Promise<number> {
  return mongo.addShopBankAccounts(rows);
}

export async function getShopBankInventoryByBank(): Promise<
  { bankCode: string; stockCount: number; minPrice: number; maxPrice: number }[]
> {
  return mongo.getShopBankInventoryByBank();
}

export async function buyShopBankRandom(params: {
  userId: string;
  bankCode: string;
  quantity: number;
}): Promise<
  | { ok: true; saleId: string; quantity: number; totalAmount: number; items: Record<string, unknown>[] }
  | { ok: false; error: string }
> {
  return mongo.buyShopBankRandom(params);
}

export async function getShopBankSalesByUser(userId: string, limit?: number): Promise<Record<string, unknown>[]> {
  return mongo.getShopBankSalesByUser(userId, limit);
}

export async function getShopBankRevenue(
  fromTs: number,
  toTs: number,
): Promise<{ soldCount: number; revenue: number }> {
  return mongo.getShopBankRevenue(fromTs, toTs);
}
