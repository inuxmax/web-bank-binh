import type { UserRecord } from './db-types';

export const USER_BANNED_MESSAGE = 'Tài khoản đã bị khóa';

export function isUserBanned(u: Pick<UserRecord, 'isBanned'>): boolean {
  return u.isBanned === true;
}
