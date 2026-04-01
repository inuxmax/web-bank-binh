import 'server-only';

import { getAccessToken } from './hpay-auth';

function getRuntimeRequire(): NodeRequire {
  if (typeof __non_webpack_require__ !== 'undefined') return __non_webpack_require__;
  return Function('return require')() as NodeRequire;
}

function getNodeCrypto(): typeof import('crypto') {
  return getRuntimeRequire()('crypto') as typeof import('crypto');
}

function getHttpTimeoutMs() {
  const raw = Number(process.env.HPAY_HTTP_TIMEOUT_MS || '');
  if (!Number.isFinite(raw) || raw < 5000) return 60000;
  return Math.min(180000, Math.floor(raw));
}

function readPrivateKeyFromFile(keyFile: string): string | null {
  try {
    const fs = getRuntimeRequire()('fs');
    if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8');
  } catch {
    /* no fs (edge) or unreadable path */
  }
  return null;
}

function readPrivateKey(): string | null {
  const envKeyB64 = process.env.HPAY_PRIVATE_KEY_B64;
  if (envKeyB64 && envKeyB64.trim().length > 0) {
    try {
      return Buffer.from(envKeyB64, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  const envKey = process.env.HPAY_PRIVATE_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.replace(/\\n/g, '\n');
  }
  const keyFile = process.env.HPAY_PRIVATE_KEY_FILE;
  if (keyFile && String(keyFile).trim()) {
    const fromFs = readPrivateKeyFromFile(String(keyFile).trim());
    if (fromFs) return fromFs;
  }
  return null;
}

export function makeRequestId() {
  const t = Date.now().toString().slice(-10);
  const r = Math.floor(100000 + Math.random() * 900000).toString();
  return (t + r).slice(0, 20);
}

function signRSASHA256(message: string, privateKey: string) {
  const crypto = getNodeCrypto();
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function buildHeaders(authHeader: string, midOverride?: string) {
  const mid = (midOverride || process.env.HPAY_X_API_MID || '').trim();
  const rawAuth = authHeader || process.env.HPAY_AUTH_TOKEN || '';
  const auth = rawAuth.toLowerCase().startsWith('bearer ') ? rawAuth : rawAuth ? `Bearer ${rawAuth}` : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (mid) headers['x-api-mid'] = mid;
  if (auth) headers.Authorization = auth;
  return headers;
}

export type DecodedVa = Record<string, string | undefined>;

/** Gợi ý khi Sinpay báo lỗi chữ ký (token OAuth vẫn đã được gửi). */
export function hpaySignatureHint(raw: { errorMessage?: string; errorCode?: string }): string | undefined {
  const msg = String(raw.errorMessage || '');
  if (/signature|chữ ký|sign(ature)?\s*fail/i.test(msg)) {
    return (
      'Token OAuth (Bearer) đã được lấy và gửi theo docs Get Access Token. ' +
      'Lỗi chữ ký RSA thường do private key không khớp public key đã đăng ký với Sinpay cho MID, hoặc sai HPAY_PASSCODE. ' +
      'Cần đăng ký đúng public key cặp với HPAY_PRIVATE_KEY_* hoặc dùng lại private key Sinpay đã cấp.'
    );
  }
  return undefined;
}

export async function createVirtualAccount(params: {
  requestId?: string;
  vaName: string;
  vaType?: string;
  vaCondition?: string;
  vaAmount?: string;
  remark?: string;
  vaExpirationTime?: number;
  bankCode?: string;
  merchantIdOverride?: string;
  passcodeOverride?: string;
  clientIdOverride?: string;
  clientSecretOverride?: string;
  xApiMidOverride?: string;
}) {
  const baseUrl = process.env.HPAY_BASE_URL || 'https://openapi.htpgroup.com.vn';
  const url = `${baseUrl}/service/va/v1/create`;
  const merchantId = params.merchantIdOverride || process.env.HPAY_MERCHANT_ID || '';
  const passcode = params.passcodeOverride || process.env.HPAY_PASSCODE || '';
  const midForHeader =
    (params.xApiMidOverride || '').trim() ||
    (params.merchantIdOverride || '').trim() ||
    (process.env.HPAY_X_API_MID || '').trim() ||
    (process.env.HPAY_MERCHANT_ID || '').trim();

  const privateKey = readPrivateKey();
  if (!privateKey) {
    throw new Error(
      'Không tìm thấy private key: HPAY_PRIVATE_KEY_B64, HPAY_PRIVATE_KEY, hoặc HPAY_PRIVATE_KEY_FILE',
    );
  }
  try {
    const crypto = getNodeCrypto();
    crypto.createPrivateKey({ key: privateKey, format: 'pem' });
  } catch {
    throw new Error('Private key không hợp lệ (PEM)');
  }

  const payload: Record<string, string | number> = {
    requestId: params.requestId || makeRequestId(),
    merchantId,
    vaType: params.vaType ?? '1',
    vaName: params.vaName,
    vaCondition: params.vaCondition ?? '2',
  };
  if (params.bankCode && String(params.bankCode).trim() !== '') payload.bankCode = String(params.bankCode).trim();
  if (params.vaAmount && String(params.vaAmount).trim() !== '') payload.vaAmount = String(params.vaAmount);
  if (params.remark && params.remark.trim() !== '') payload.remark = params.remark;
  if (params.vaExpirationTime) payload.vaExpirationTime = Number(params.vaExpirationTime);

  const tokenResp = await getAccessToken(process.env.HPAY_TOKEN_SCOPE || 'va', {
    clientId: params.clientIdOverride,
    clientSecret: params.clientSecretOverride,
    mid: midForHeader,
  });
  if (!tokenResp.access_token) throw new Error('Không lấy được token VA');

  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  if (!passcode) throw new Error('Thiếu HPAY_PASSCODE');
  const signature = signRSASHA256(`${data}|${passcode}`, privateKey);

  const headers = buildHeaders(`Bearer ${tokenResp.access_token}`, midForHeader);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data, signature }),
    signal: AbortSignal.timeout(getHttpTimeoutMs()),
  });

  const resData = (await res.json()) as {
    errorCode?: string;
    errorMessage?: string;
    data?: string;
    signature?: string;
  };

  let decoded: DecodedVa | null = null;
  try {
    if (resData.data) {
      const buf = Buffer.from(resData.data, 'base64');
      decoded = JSON.parse(buf.toString('utf8')) as DecodedVa;
    }
  } catch {
    /* ignore */
  }
  return { raw: resData, decoded, requestId: payload.requestId as string };
}

export async function getAccountBalance(opts?: {
  requestId?: string;
  merchantIdOverride?: string;
  passcodeOverride?: string;
  clientIdOverride?: string;
  clientSecretOverride?: string;
  xApiMidOverride?: string;
}) {
  const baseUrl = process.env.HPAY_BASE_URL || 'https://openapi.htpgroup.com.vn';
  const url = `${baseUrl}/service/account/v1/get-balance`;
  const merchantId = opts?.merchantIdOverride || process.env.HPAY_MERCHANT_ID || '';
  const passcode = opts?.passcodeOverride || process.env.HPAY_PASSCODE || '';
  const midForHeader =
    (opts?.xApiMidOverride || '').trim() ||
    String(opts?.merchantIdOverride || '').trim() ||
    (process.env.HPAY_X_API_MID || '').trim() ||
    String(process.env.HPAY_MERCHANT_ID || '').trim();

  const privateKey = readPrivateKey();
  if (!privateKey) throw new Error('Không tìm thấy private key');
  const crypto = getNodeCrypto();
  crypto.createPrivateKey({ key: privateKey, format: 'pem' });

  const payload = {
    requestId: opts?.requestId || makeRequestId(),
    merchantId,
  };

  const tokenResp = await getAccessToken('account', {
    clientId: opts?.clientIdOverride,
    clientSecret: opts?.clientSecretOverride,
    mid: midForHeader,
  });
  if (!tokenResp.access_token) throw new Error('Không lấy được token Account');

  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const signature = signRSASHA256(`${data}|${passcode}`, privateKey);

  const headers = buildHeaders(`Bearer ${tokenResp.access_token}`, midForHeader);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data, signature }),
    signal: AbortSignal.timeout(getHttpTimeoutMs()),
  });

  const resData = (await res.json()) as { data?: string; errorCode?: string; errorMessage?: string };
  let decoded: Record<string, unknown> | null = null;
  try {
    if (resData.data) {
      const buf = Buffer.from(resData.data, 'base64');
      decoded = JSON.parse(buf.toString('utf8')) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return { raw: resData, decoded, requestId: payload.requestId };
}

export async function createIBFT(params: {
  requestId?: string;
  bankCode?: string;
  bankName?: string;
  accountNumber: string;
  accountName: string;
  amount: string | number;
  remark?: string;
  callbackUrl?: string;
  orderCode?: string;
  merchantIdOverride?: string;
  passcodeOverride?: string;
  clientIdOverride?: string;
  clientSecretOverride?: string;
  xApiMidOverride?: string;
}) {
  const baseUrl = process.env.HPAY_BASE_URL || 'https://openapi.htpgroup.com.vn';
  const path = process.env.HPAY_IBFT_PATH || '/service/firm/v1/transfer';
  const url = `${baseUrl}${path}`;
  const merchantId = params.merchantIdOverride || process.env.HPAY_MERCHANT_ID || '';
  const passcode = params.passcodeOverride || process.env.HPAY_PASSCODE || '';
  const privateKey = readPrivateKey();
  if (!privateKey) throw new Error('Không tìm thấy private key');
  const crypto = getNodeCrypto();
  crypto.createPrivateKey({ key: privateKey, format: 'pem' });

  const payload: Record<string, string> = {
    requestId: params.requestId || makeRequestId(),
    merchantId,
    bankName:
      (params.bankName && params.bankName.trim()) || (params.bankCode && String(params.bankCode).trim()) || '',
    bankAccountNumber: params.accountNumber,
    bankAccountName: params.accountName,
    amount: String(params.amount),
  };
  payload.orderCode = params.orderCode || `IBFT${payload.requestId.slice(-12)}`;
  if (params.remark && params.remark.trim() !== '') payload.remark = params.remark.trim();
  if (params.callbackUrl && params.callbackUrl.trim() !== '')
    payload.callbackUrl = params.callbackUrl.trim().replace(/`/g, '');

  const tokenResp = await getAccessToken(process.env.HPAY_FIRM_SCOPE || 'ibft', {
    clientId: params.clientIdOverride,
    clientSecret: params.clientSecretOverride,
    mid: params.xApiMidOverride,
  });
  if (!tokenResp.access_token) throw new Error('Không lấy được token chi hộ');

  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const signature = signRSASHA256(`${data}|${passcode}`, privateKey);

  const headers = buildHeaders(`Bearer ${tokenResp.access_token}`, params.xApiMidOverride);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data, signature }),
    signal: AbortSignal.timeout(getHttpTimeoutMs()),
  });

  const resData = (await res.json()) as { data?: string; errorCode?: string; errorMessage?: string };
  let decoded: Record<string, unknown> | null = null;
  try {
    if (resData.data) {
      const buf = Buffer.from(resData.data, 'base64');
      decoded = JSON.parse(buf.toString('utf8')) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {
    raw: resData,
    decoded,
    requestId: payload.requestId,
    debug: { request: payload, response: decoded || resData },
  };
}

export async function getIBFTStatus(params: { requestId?: string; orderId?: string }) {
  const baseUrl = process.env.HPAY_BASE_URL || 'https://openapi.htpgroup.com.vn';
  const ibftPath = process.env.HPAY_IBFT_STATUS_PATH || '/service/firm/v1/get-status';
  const url = `${baseUrl}${ibftPath}`;
  const merchantId = process.env.HPAY_MERCHANT_ID || '';
  const passcode = process.env.HPAY_PASSCODE || '';
  const privateKey = readPrivateKey();
  if (!privateKey) throw new Error('Không tìm thấy private key');
  const payload: Record<string, string> = {
    requestId: params.requestId || makeRequestId(),
    merchantId,
  };
  if (params.orderId) payload.orderId = params.orderId;

  const tokenResp = await getAccessToken(process.env.HPAY_FIRM_SCOPE || 'ibft');
  if (!tokenResp.access_token) throw new Error('Không lấy được token chi hộ');

  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const signature = signRSASHA256(`${data}|${passcode}`, privateKey);

  const authHeader = `Bearer ${tokenResp.access_token}`;
  const headers = buildHeaders(authHeader, process.env.HPAY_X_API_MID);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data, signature }),
    signal: AbortSignal.timeout(getHttpTimeoutMs()),
  });
  const resData = (await res.json()) as { data?: string };
  let decoded: Record<string, unknown> | null = null;
  try {
    if (resData.data) {
      const buf = Buffer.from(resData.data, 'base64');
      decoded = JSON.parse(buf.toString('utf8')) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return { raw: resData, decoded, requestId: payload.requestId };
}

export function getBankOverrides(bankCode: string | undefined) {
  const code = String(bankCode || '').trim().toUpperCase();
  if (code === 'MSB') {
    return {
      midOverride: (process.env.HPAY_MERCHANT_ID_MSB || '').trim() || undefined,
      passOverride: (process.env.HPAY_PASSCODE_MSB || '').trim() || undefined,
      clientIdOverride: (process.env.HPAY_CLIENT_ID_MSB || '').trim() || undefined,
      clientSecretOverride: (process.env.HPAY_CLIENT_SECRET_MSB || '').trim() || undefined,
      xApiMidOverride:
        (process.env.HPAY_X_API_MID_MSB || '').trim() ||
        (process.env.HPAY_MERCHANT_ID_MSB || '').trim() ||
        undefined,
    };
  }
  if (code === 'KLB') {
    return {
      midOverride: (process.env.HPAY_MERCHANT_ID_KLB || '').trim() || undefined,
      passOverride: (process.env.HPAY_PASSCODE_KLB || '').trim() || undefined,
      clientIdOverride: (process.env.HPAY_CLIENT_ID_KLB || '').trim() || undefined,
      clientSecretOverride: (process.env.HPAY_CLIENT_SECRET_KLB || '').trim() || undefined,
      xApiMidOverride:
        (process.env.HPAY_X_API_MID_KLB || '').trim() ||
        (process.env.HPAY_MERCHANT_ID_KLB || '').trim() ||
        undefined,
    };
  }
  return {};
}
