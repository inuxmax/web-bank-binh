import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

function md5Hex(s: string) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function toAmountNumber(v: unknown) {
  const n = Number(String(v || '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Callback IPN Sinpay — GET query giống bot (verify secure_code MD5) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const vaAccount = String(searchParams.get('va_account') || '');
  const amount = String(searchParams.get('amount') || '');
  const cashinId = String(searchParams.get('cashin_id') || '');
  const transactionId = String(searchParams.get('transaction_id') || '');
  const clientRequestId = String(searchParams.get('client_request_id') || '');
  const merchantId = String(searchParams.get('merchant_id') || '');
  const secureCode = String(searchParams.get('secure_code') || '').toLowerCase();

  const msbMerchant = String(process.env.HPAY_MERCHANT_ID_MSB || '').trim();
  const klbMerchant = String(process.env.HPAY_MERCHANT_ID_KLB || '').trim();
  const msbMid = String(process.env.HPAY_X_API_MID_MSB || '').trim();
  const klbMid = String(process.env.HPAY_X_API_MID_KLB || '').trim();
  const passcode =
    merchantId && (merchantId === msbMerchant || merchantId === msbMid)
      ? String(process.env.HPAY_PASSCODE_MSB || '').trim()
      : merchantId && (merchantId === klbMerchant || merchantId === klbMid)
        ? String(process.env.HPAY_PASSCODE_KLB || '').trim()
        : String(process.env.HPAY_PASSCODE || '').trim();

  const clear = `${vaAccount}|${amount}|${cashinId}|${transactionId}|${passcode}|${clientRequestId}|${merchantId}`;
  const expected = md5Hex(clear);
  const ok = Boolean(secureCode && expected === secureCode);

  let transferContent = '';
  try {
    const t = String(searchParams.get('transfer_content') || '');
    if (t) transferContent = Buffer.from(t, 'base64').toString('utf8');
  } catch {
    /* ignore */
  }

  if (ok) {
    const timePaid = String(searchParams.get('time_paid') || '');
    const bank = String(searchParams.get('va_bank_name') || '');
    const orderId = String(searchParams.get('order_id') || '');

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

  return NextResponse.json({
    error: ok ? '00' : '01',
    message: ok ? 'Success' : 'Invalid secure_code',
  });
}
