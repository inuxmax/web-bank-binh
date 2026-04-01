import 'server-only';

import * as db from '@/lib/server/db';
import { USER_BANNED_MESSAGE } from '@/lib/server/user-guard';

function getRuntimeRequire(): NodeRequire {
  if (typeof __non_webpack_require__ !== 'undefined') return __non_webpack_require__;
  return Function('return require')() as NodeRequire;
}

/** Không `import bcryptjs` tĩnh — webpack client/instrument sẽ bundle `dist/bcrypt.js` và lỗi resolve `crypto`. */
function bcryptCompareSync(plain: string, hash: string): boolean {
  const bcrypt = getRuntimeRequire()('bcryptjs');
  return bcrypt.compareSync(plain, hash);
}

export async function linkTelegramWithCredentials(
  telegramUserId: string,
  telegramUsername: string | undefined,
  webLogin: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const rawLogin = webLogin.trim();
  if (!rawLogin || !password) {
    return { ok: false, error: 'Thiếu tên đăng nhập hoặc mật khẩu' };
  }
  const loginLower = rawLogin.toLowerCase();
  const u =
    (await db.findUserByWebLogin(loginLower)) || (await db.findUser(`web_${loginLower}`)) || null;

  if (!u || !u.passwordHash) {
    return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu' };
  }

  const ok = bcryptCompareSync(password, u.passwordHash);
  if (!ok) {
    return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu' };
  }

  if (u.isBanned === true) {
    return { ok: false, error: USER_BANNED_MESSAGE };
  }

  await db.assignTelegramToUser(u.id, String(telegramUserId), telegramUsername);
  return { ok: true, userId: u.id };
}
