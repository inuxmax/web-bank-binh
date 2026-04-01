import type { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: string;
  username?: string;
  isAdmin?: boolean;
  adminPermissions?: string[];
}

function sessionPassword(): string {
  const p = process.env.SESSION_SECRET?.trim();
  if (p && p.length >= 32) return p;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
  }
  return 'dev-only-session-secret-min-32-chars!!';
}

export function getSessionOptions(): SessionOptions {
  return {
    password: sessionPassword(),
    cookieName: 'hpay_web_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 14,
      sameSite: 'lax' as const,
      path: '/',
    },
  };
}
