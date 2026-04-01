import 'server-only';

let cache: { token: string; expiresAt: number; scope: string; clientId: string; mid: string } = {
  token: '',
  expiresAt: 0,
  scope: '',
  clientId: '',
  mid: '',
};

function isValid() {
  return cache.token && Date.now() < cache.expiresAt - 30000;
}

export async function getAccessToken(
  scope = 'va',
  { clientId, clientSecret, mid }: { clientId?: string; clientSecret?: string; mid?: string } = {},
) {
  const resolvedBaseUrl = process.env.HPAY_BASE_URL || 'https://openapi-sandbox.htpgroup.com.vn';
  const resolvedClientId = (clientId || process.env.HPAY_CLIENT_ID || '').trim();
  const resolvedClientSecret = (clientSecret || process.env.HPAY_CLIENT_SECRET || '').trim();
  const resolvedMid = (mid || process.env.HPAY_X_API_MID || '').trim();

  if (
    isValid() &&
    cache.scope === scope &&
    cache.clientId === resolvedClientId &&
    cache.mid === resolvedMid
  ) {
    return {
      access_token: cache.token,
      expires_in: Math.floor((cache.expiresAt - Date.now()) / 1000),
    };
  }

  const url = `${resolvedBaseUrl}/service/${scope}/v1/oauth2/token`;
  const params = new URLSearchParams();
  params.set('client_id', resolvedClientId);
  params.set('client_secret', resolvedClientSecret);
  params.set('grant_type', 'client_credentials');
  params.set('scope', scope);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (resolvedMid) headers['x-api-mid'] = resolvedMid;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    let errBody: { error?: string; error_description?: string } = {};
    try {
      errBody = await res.json();
    } catch {
      /* ignore */
    }
    const msg = errBody.error_description || errBody.error || res.statusText;
    const e = new Error(msg) as Error & { status?: number };
    e.status = res.status;
    throw e;
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  const token = data.access_token || '';
  const expiresIn = data.expires_in || 0;
  if (token && expiresIn) {
    cache = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
      scope,
      clientId: resolvedClientId,
      mid: resolvedMid,
    };
  }
  return { access_token: token, expires_in: expiresIn };
}
