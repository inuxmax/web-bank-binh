import 'server-only';

import type { SessionData } from '@/lib/session-config';
import * as db from './db';

export const ADMIN_PERMISSIONS = [
  'admin_home',
  'users',
  'withdrawals',
  'ctv',
  'announcements',
  'va_bulk',
  'balance',
  'ibft',
  'ibft_history',
  'settings',
  'permissions',
  'shop_bank',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  admin_home: 'Bảng quản trị',
  users: 'Người dùng',
  withdrawals: 'Duyệt rút tiền',
  ctv: 'Quản lý CTV',
  announcements: 'Thông báo',
  va_bulk: 'Tạo VA số lượng lớn',
  balance: 'Số dư Sinpay',
  ibft: 'Chi hộ',
  ibft_history: 'Lịch sử chi hộ',
  settings: 'Cấu hình',
  permissions: 'Phân quyền admin',
  shop_bank: 'Shop bank',
};

const PERM_SET = new Set<string>(ADMIN_PERMISSIONS);

export function normalizeAdminPermissions(input: unknown): AdminPermission[] {
  if (!Array.isArray(input)) return [];
  const out: AdminPermission[] = [];
  for (const p of input) {
    const key = String(p || '').trim() as AdminPermission;
    if (PERM_SET.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

export function isSuperAdminSession(session: SessionData): boolean {
  return Boolean(session.isAdmin && String(session.userId || '') === 'admin');
}

export function hasAdminPermission(perms: AdminPermission[], required: AdminPermission): boolean {
  return perms.includes(required);
}

export async function getSessionAdminPermissions(session: SessionData): Promise<AdminPermission[]> {
  if (!session.userId) return [];
  if (String(session.userId) === 'admin') return [...ADMIN_PERMISSIONS];
  const u = await db.findUser(session.userId);
  if (!u) return [];
  return normalizeAdminPermissions(u.adminPermissions);
}

