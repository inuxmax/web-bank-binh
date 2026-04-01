/** Kiểu dữ liệu domain (persist qua MongoDB / mongoose). */

export type UserRecord = {
  id: string;
  username: string;
  fullName?: string;
  phone?: string;
  email?: string;
  spamMutedUntil: number;
  spamReason: string;
  /** Khóa tài khoản: không đăng nhập, không gọi API user */
  isBanned?: boolean;
  isActive: boolean;
  feePercent: number | null;
  ipnFeeFlat: number | null;
  withdrawFeeFlat: number | null;
  vaLimit: number | null;
  balance: number;
  createdVA: number;
  passwordHash?: string;
  webLogin?: string;
  /** ID Telegram (string) sau khi /lienket — một Telegram chỉ gắn một user */
  telegramId?: string;
  /** Mã một lần để mở t.me/bot?start= (kết nối từ dashboard) */
  telegramLinkToken?: string;
  telegramLinkExpires?: number;
  resetCodeHash?: string;
  resetCodeExpires?: number;
  registerIp?: string;
  registerAt?: number;
  lastLoginIp?: string;
  lastLoginAt?: number;
  ctvStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  ctvCode?: string;
  adminPermissions?: string[];
  referredByCode?: string;
  referredByUserId?: string;
  ctvRatePercent?: number | null;
  ctvAppliedAt?: number;
  ctvApprovedAt?: number;
  ctvCommissionTotal?: number;
  ctvCommissionCount?: number;
  /** Tài khoản nhận tiền đã dùng gần đây (Telegram rút tiền). */
  savedWithdrawAccounts?: {
    bankCode: string;
    bankAccount: string;
    bankHolder: string;
    updatedAt: number;
  }[];
};

export type VaRecord = Record<string, unknown>;
