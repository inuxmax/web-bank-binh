import 'server-only';

import mongoose, { Schema, models, model } from 'mongoose';

const VaRecordSchema = new Schema({}, { strict: false, collection: 'va_records' });
VaRecordSchema.index({ requestId: 1 }, { unique: true, sparse: true });

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    username: { type: String, default: '' },
    spamMutedUntil: { type: Number, default: 0 },
    spamReason: { type: String, default: '' },
    isBanned: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    feePercent: { type: Schema.Types.Mixed, default: null },
    ipnFeeFlat: { type: Schema.Types.Mixed, default: null },
    withdrawFeeFlat: { type: Schema.Types.Mixed, default: null },
    vaLimit: { type: Schema.Types.Mixed, default: null },
    balance: { type: Number, default: 0 },
    createdVA: { type: Number, default: 0 },
    passwordHash: String,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCodeHash: String,
    twoFactorCodeExpires: { type: Number, default: null },
    webLogin: String,
    email: { type: String, sparse: true, unique: true },
    fullName: String,
    phone: String,
    telegramId: { type: String, sparse: true, unique: true },
    telegramUsername: String,
    telegramLinkToken: { type: String, sparse: true, unique: true },
    telegramLinkExpires: { type: Number, default: null },
    resetCodeHash: String,
    resetCodeExpires: { type: Number, default: null },
    registerIp: String,
    registerAt: Number,
    lastLoginIp: String,
    lastLoginAt: Number,
    webLastSeenAt: Number,
    ctvStatus: { type: String, default: 'none' },
    ctvCode: { type: String, sparse: true, unique: true },
    adminPermissions: [{ type: String }],
    referredByCode: String,
    referredByUserId: String,
    ctvRatePercent: { type: Schema.Types.Mixed, default: null },
    ctvCustomerFeePercent: { type: Schema.Types.Mixed, default: null },
    ctvAppliedAt: Number,
    ctvApprovedAt: Number,
    ctvCommissionTotal: { type: Number, default: 0 },
    ctvCommissionCount: { type: Number, default: 0 },
    savedWithdrawAccounts: [
      {
        bankCode: { type: String, default: '' },
        bankAccount: { type: String, default: '' },
        bankHolder: { type: String, default: '' },
        updatedAt: { type: Number, default: 0 },
      },
    ],
  },
  { collection: 'users' },
);

const WithdrawalSchema = new Schema({}, { strict: false, collection: 'withdrawals' });
WithdrawalSchema.index({ id: 1 }, { unique: true, sparse: true });

const AppConfigSchema = new Schema(
  {
    _id: { type: String, default: 'global' },
    globalFeePercent: { type: Number, default: 0 },
    ipnFeeFlat: { type: Number, default: 4000 },
    withdrawFeeFlat: { type: Number, default: 4000 },
    minWithdrawAmount: { type: Number, default: 10000 },
    ctvCommissionPercent: { type: Number, default: 1 },
    globalVaLimit: { type: Schema.Types.Mixed, default: null },
    autoApproveNewUsers: { type: Boolean, default: false },
  },
  { collection: 'app_config' },
);

const BalanceHistorySchema = new Schema(
  {
    ts: { type: Number, index: true },
    balance: Number,
    balanceRaw: String,
    source: String,
    adminId: String,
  },
  { collection: 'balance_histories' },
);

const UserBalanceHistorySchema = new Schema(
  {
    ts: { type: Number, index: true },
    userId: { type: String, index: true },
    delta: Number,
    balanceAfter: Number,
    reason: String,
    ref: String,
  },
  { collection: 'user_balance_histories' },
);

const IbftHistorySchema = new Schema(
  {
    ts: { type: Number, index: true },
    adminId: String,
    userId: String,
    username: String,
    merchant: String,
    bankCode: String,
    accountNumber: String,
    accountName: String,
    amount: Number,
    remark: String,
    orderId: String,
    tranStatus: String,
    errorCode: String,
    errorMessage: String,
  },
  { collection: 'ibft_histories' },
);

export const VaRecordModel = models.VaRecord || model('VaRecord', VaRecordSchema);
export const UserModel = models.User || model('User', UserSchema);
export const WithdrawalModel = models.Withdrawal || model('Withdrawal', WithdrawalSchema);
export const AppConfigModel = models.AppConfig || model('AppConfig', AppConfigSchema);
export const BalanceHistoryModel = models.BalanceHistory || model('BalanceHistory', BalanceHistorySchema);
export const UserBalanceHistoryModel =
  models.UserBalanceHistory || model('UserBalanceHistory', UserBalanceHistorySchema);
export const IbftHistoryModel = models.IbftHistory || model('IbftHistory', IbftHistorySchema);
