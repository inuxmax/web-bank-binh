import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from './session-config';
import { getSessionOptions } from './session-config';

export async function getSession() {
  const c = await cookies();
  return getIronSession<SessionData>(c, getSessionOptions());
}
