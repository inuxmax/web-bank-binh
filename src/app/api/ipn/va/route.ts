import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as db from '@/lib/server/db';
import { buildVaPaidText, notifyUserTelegramByUserId } from '@/lib/server/notify';

export const runtime = 'nodejs';

function md5Hex(s: string) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function toAmountNumber(v: unknown) {
  const n = Number(String(v || '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function firstNonEmpty(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    const v = String(obj[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

async function readPayload(req: Request): Promise<Record<string, unknown>> {
  const query = Object.fromEntries(new URL(req.url).searchParams.entries()) as Record<string, unknown>;
  const contentType = String(req.headers.get('content-type') || '').toLowerCase();
  let body: Record<string, unknown> = {};

  if (req.method === 'POST') {
    if (contentType.includes('application/json')) {
      body = ((await req.json().catch(() => ({}))) as Record<string, unknown>) || {};
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await req.formData().catch(() => null);
      if (form) {
        body = {};
        for (const [k, v] of form.entries()) body[k] = String(v);
      }
    }
  }

  const merged = { ...query, ...body } as Record<string, unknown>;
  const encodedData = String(merged.data || '').trim();
  if (encodedData) {
    try {
      const decoded = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8')) as Record<string, unknown>;
      return { ...merged, ...decoded };
    } catch {
      // ignore invalid base64 json
    }
  }
  return merged;
}

function verifySecureCode(params: {
  vaAccount: string;
  amount: string;
  cashinId: string;
  transactionId: string;
  clientRequestId: string;
  merchantId: string;
  secureCode: string;
}) {
  const { vaAccount, amount, cashinId, transactionId, clientRequestId, merchantId, secureCode } = params;

  const msbMerchant = String(process.env.HPAY_MERCHANT_ID_MSB || '').trim();
  const klbMerchant = String(process.env.HPAY_MERCHANT_ID_KLB || '').trim();
  const msbMid = String(process.env.HPAY_X_API_MID_MSB || '').trim();
  const klbMid = String(process.env.HPAY_X_API_MID_KLB || '').trim();
  const passcodeByMerchant =
    merchantId && (merchantId === msbMerchant || merchantId === msbMid)
      ? String(process.env.HPAY_PASSCODE_MSB || '').trim()
      : merchantId && (merchantId === klbMerchant || merchantId === klbMid)
        ? String(process.env.HPAY_PASSCODE_KLB || '').trim()
        : String(process.env.HPAY_PASSCODE || '').trim();
  const passcodeCandidates = [
    passcodeByMerchant,
    String(process.env.HPAY_PASSCODE_MSB || '').trim(),
    String(process.env.HPAY_PASSCODE_KLB || '').trim(),
    String(process.env.HPAY_PASSCODE || '').trim(),
  ].filter(Boolean);
  const uniqPasscodes = [...new Set(passcodeCandidates)];
  const expectedCodes = uniqPasscodes.flatMap((p) => [
    // Legacy/bot format
    md5Hex(`${vaAccount}|${amount}|${cashinId}|${transactionId}|${p}|${clientRequestId}|${merchantId}`),
    // Variant some integrators use (merchant and clientRequest swapped)
    md5Hex(`${vaAccount}|${amount}|${cashinId}|${transactionId}|${p}|${merchantId}|${clientRequestId}`),
  ]);
  return Boolean(secureCode && expectedCodes.includes(secureCode));
}

async function handleIpn(req: Request) {
  const payload = await readPayload(req);
  const vaAccount = firstNonEmpty(payload, ['va_account', 'vaAccount']);
  const amount = firstNonEmpty(payload, ['amount', 'va_amount', 'vaAmount']);
  const cashinId = firstNonEmpty(payload, ['cashin_id', 'cashinId']);
  const transactionId = firstNonEmpty(payload, ['transaction_id', 'transactionId']);
  const clientRequestId = firstNonEmpty(payload, ['client_request_id', 'clientRequestId', 'requestId']);
  const merchantId = firstNonEmpty(payload, ['merchant_id', 'merchantId']);
  const secureCode = firstNonEmpty(payload, ['secure_code', 'secureCode']).toLowerCase();
  let ok = verifySecureCode({
    vaAccount,
    amount,
    cashinId,
    transactionId,
    clientRequestId,
    merchantId,
    secureCode,
  });
  const fallbackByRequestIdEnabled =
    String(process.env.HPAY_IPN_ALLOW_FALLBACK_BY_REQUEST_ID || 'true').trim().toLowerCase() !== 'false';
  if (!ok && fallbackByRequestIdEnabled && clientRequestId) {
    try {
      const all = await db.loadAll();
      const byReq = all.find(
        (r) =>
          String(r.requestId || '') === clientRequestId ||
          String(r.parentRequestId || '') === clientRequestId,
      );
      const amountNum = toAmountNumber(amount);
      const vaMatches =
        !vaAccount ||
        !String(byReq?.vaAccount || '').trim() ||
        String(byReq?.vaAccount || '').trim() === String(vaAccount).trim();
      if (byReq && String(byReq.status || '') !== 'paid' && amountNum > 0 && vaMatches) {
        ok = true;
        console.warn('[IPN_VA_FALLBACK_BY_REQUEST_ID]', {
          clientRequestId,
          vaAccount,
          transactionId,
          cashinId,
          amount,
        });
      }
    } catch {
      // ignore fallback lookup failure
    }
  }

  let transferContent = '';
  try {
    const t = firstNonEmpty(payload, ['transfer_content', 'transferContent']);
    if (t) transferContent = Buffer.from(t, 'base64').toString('utf8');
  } catch {
    /* ignore */
  }

  if (ok) {
    const timePaid = firstNonEmpty(payload, ['time_paid', 'timePaid']);
    const bank = firstNonEmpty(payload, ['va_bank_name', 'vaBankName', 'bankName']);
    const orderId = firstNonEmpty(payload, ['order_id', 'orderId']);

    let rec = (await db.getByRequestId(clientRequestId)) || ({} as Record<string, unknown>);
    if (!(rec as { userId?: string }).userId && vaAccount) {
      try {
        const all = await db.loadAll();
        const candidates = all
          .filter((r) => String(r.vaAccount || '') === String(vaAccount))
          .sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
        if (candidates.length) rec = { ...candidates[0], ...rec };
      } catch {
        /* ignore */
      }
    }

    const gross = toAmountNumber(amount);
    const cfg = await db.getConfig();
    let feeFlat = Math.max(0, Number((cfg as { ipnFeeFlat?: number }).ipnFeeFlat || 0) || 0);
    const uid = (rec as { userId?: string }).userId ? String((rec as { userId?: string }).userId) : '';
    if (uid) {
      const u = await db.getUser(uid);
      const uf =
        u.ipnFeeFlat !== null && u.ipnFeeFlat !== undefined ? Number(u.ipnFeeFlat) : NaN;
      if (Number.isFinite(uf) && uf >= 0) feeFlat = uf;
    }
    const credited = Math.max(0, gross - feeFlat);

    const paymentKey = String(transactionId || cashinId || '').trim();
    let alreadyProcessed = false;
    try {
      const allPaid = (await db.loadAll()).filter((r) => String(r.status) === 'paid');
      if (paymentKey) {
        alreadyProcessed = allPaid.some(
          (r) =>
            String(r.transactionId || '') === paymentKey ||
            String(r.cashinId || '') === paymentKey,
        );
      } else {
        const sig = `${String(vaAccount)}|${String(gross)}|${String(timePaid)}`;
        alreadyProcessed = allPaid.some(
          (r) =>
            `${String(r.vaAccount)}|${toAmountNumber(r.amount)}|${String(r.timePaid || '')}` === sig,
        );
      }
    } catch {
      /* ignore */
    }

    const baseRequestId = String(clientRequestId || '').trim();
    const requestIdToStore =
      String((rec as { status?: string }).status || '').trim() === 'paid'
        ? paymentKey
          ? `${baseRequestId}:${paymentKey}`
          : `${baseRequestId}:${Date.now()}`
        : baseRequestId;

    if (!alreadyProcessed) {
      if (uid) {
        const u = await db.getUser(uid);
        const after = u.balance + credited;
        await db.updateUser(uid, { balance: after });
        await db.addUserBalanceHistory({
          ts: Date.now(),
          userId: uid,
          delta: credited,
          balanceAfter: after,
          reason: 'ipn',
          ref: requestIdToStore,
        });

        // Commission for approved CTV referrer (if any), credited directly to balance.
        const refUserId = String(u.referredByUserId || '').trim();
        if (refUserId) {
          const ctvUser = await db.findUser(refUserId);
          if (ctvUser && ctvUser.ctvStatus === 'approved') {
            const cfgRate = Number((cfg as { ctvCommissionPercent?: number }).ctvCommissionPercent);
            const rate = Number(
              ctvUser.ctvRatePercent ??
                (Number.isFinite(cfgRate) ? cfgRate : undefined) ??
                process.env.CTV_COMMISSION_PERCENT ??
                1,
            );
            const commission = Math.max(0, Math.floor((credited * (Number.isFinite(rate) ? rate : 0)) / 100));
            if (commission > 0) {
              const ctvAfter = Number(ctvUser.balance || 0) + commission;
              await db.updateUser(ctvUser.id, {
                balance: ctvAfter,
                ctvCommissionTotal: Number(ctvUser.ctvCommissionTotal || 0) + commission,
                ctvCommissionCount: Number(ctvUser.ctvCommissionCount || 0) + 1,
              });
              await db.addUserBalanceHistory({
                ts: Date.now(),
                userId: ctvUser.id,
                delta: commission,
                balanceAfter: ctvAfter,
                reason: 'ctv_commission',
                ref: requestIdToStore,
              });
            }
          }
        }
        try {
          const text = buildVaPaidText({
            vaAccount,
            bankName: bank,
            ownerName: String((rec as { name?: string; vaName?: string }).name || (rec as { vaName?: string }).vaName || '').trim(),
            amount: gross,
            credited,
            feeFlat,
            requestId: requestIdToStore,
            transactionId: transactionId || cashinId,
            timePaid: timePaid || String(Date.now()),
          });
          await notifyUserTelegramByUserId(uid, text);
        } catch {
          // ignore telegram notify error
        }
      }
      await db.upsert({
        ...rec,
        requestId: requestIdToStore,
        parentRequestId: baseRequestId || undefined,
        status: 'paid',
        vaAccount,
        amount: String(gross),
        netAmount: String(credited),
        feeFlat,
        vaBank: bank,
        orderId,
        transactionId,
        cashinId,
        timePaid,
        transferContent: transferContent || (rec as { remark?: string }).remark,
        userId: uid || (rec as { userId?: string }).userId,
        createdAt: Date.now(),
      });
    }
  }

  if (!ok) {
    // Keep short diagnostics for production debugging.
    console.warn('[IPN_VA_VERIFY_FAIL]', {
      method: req.method,
      vaAccount,
      amount,
      cashinId,
      transactionId,
      clientRequestId,
      merchantId,
      hasSecureCode: Boolean(secureCode),
      keys: Object.keys(payload).slice(0, 30),
    });
  }

  return NextResponse.json({
    error: ok ? '00' : '01',
    message: ok ? 'Success' : 'Invalid secure_code',
  });
}

/** Callback IPN Sinpay/Hpay — hỗ trợ GET + POST, snake_case + camelCase. */
export async function GET(req: Request) {
  return handleIpn(req);
}

export async function POST(req: Request) {
  return handleIpn(req);
}
