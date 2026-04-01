import 'server-only';

import * as db from '@/lib/server/db';
import { getBankOverrides, getTransactionDetail } from './hpay';

const POLLER_KEY = '__sinpayVaSyncPollerStarted' as const;

function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(obj[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

function isPaidStatus(v: unknown): boolean {
  const s = String(v ?? '').trim().toUpperCase();
  return ['PAID', 'SUCCESS', 'COMPLETED', 'DONE', '00'].includes(s);
}

function pollIntervalMs() {
  const raw = Number(process.env.HPAY_UNPAID_POLL_INTERVAL_MS || 90000);
  const val = Number.isFinite(raw) ? Math.floor(raw) : 90000;
  return Math.max(60000, Math.min(120000, val));
}

function pollLimit() {
  const raw = Number(process.env.HPAY_UNPAID_POLL_LIMIT || 200);
  const val = Number.isFinite(raw) ? Math.floor(raw) : 200;
  return Math.max(20, Math.min(1000, val));
}

async function markPaidByDetail(rec: Record<string, unknown>, detail: Record<string, unknown>) {
  const userId = String(rec.userId || '').trim();
  if (!userId) return false;

  const gross = num(detail.amount || detail.paidAmount || detail.vaAmount || rec.amount || rec.vaAmount);
  if (gross <= 0) return false;

  const txId = pick(detail, ['transactionId', 'tranId']);
  const cashinId = pick(detail, ['cashinId', 'cashInId']);
  const paymentKey = String(txId || cashinId || '').trim();
  const all = await db.loadAll();
  const allPaid = all.filter((r) => String(r.status || '').trim() === 'paid');
  if (paymentKey) {
    const dup = allPaid.some(
      (r) => String(r.transactionId || '') === paymentKey || String(r.cashinId || '') === paymentKey,
    );
    if (dup) return false;
  }

  const cfg = await db.getConfig();
  let feeFlat = Math.max(0, Number((cfg as { ipnFeeFlat?: number }).ipnFeeFlat || 0) || 0);
  const u = await db.getUser(userId);
  const uf = u.ipnFeeFlat !== null && u.ipnFeeFlat !== undefined ? Number(u.ipnFeeFlat) : NaN;
  if (Number.isFinite(uf) && uf >= 0) feeFlat = uf;
  const credited = Math.max(0, gross - feeFlat);

  const after = Number(u.balance || 0) + credited;
  await db.updateUser(userId, { balance: after });
  await db.addUserBalanceHistory({
    ts: Date.now(),
    userId,
    delta: credited,
    balanceAfter: after,
    reason: 'ipn',
    ref: String(rec.requestId || ''),
  });

  await db.upsert({
    ...rec,
    status: 'paid',
    amount: String(gross),
    netAmount: String(credited),
    feeFlat,
    transactionId: txId || (rec.transactionId as string),
    cashinId: cashinId || (rec.cashinId as string),
    timePaid: pick(detail, ['timePaid', 'paidAt', 'transactionTime']) || String(Date.now()),
    createdAt: Number(rec.createdAt || Date.now()),
  });
  return true;
}

async function syncSweep() {
  const rows = await db.loadAll();
  const pending = rows
    .filter((r) => String(r.status || '').trim() !== 'paid')
    .sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0))
    .slice(0, pollLimit());

  let synced = 0;
  for (const rec of pending) {
    const clientRequestId = String(rec.parentRequestId || rec.requestId || '').trim();
    if (!clientRequestId) continue;
    const bankCode = String(rec.vaBank || '').trim().toUpperCase();
    const ov = getBankOverrides(bankCode);
    try {
      const { decoded } = await getTransactionDetail({
        clientRequestId,
        merchantIdOverride: ov.midOverride,
        passcodeOverride: ov.passOverride,
        clientIdOverride: ov.clientIdOverride,
        clientSecretOverride: ov.clientSecretOverride,
        xApiMidOverride: ov.xApiMidOverride,
      });
      if (!decoded) continue;
      const status = pick(decoded, ['status', 'tranStatus', 'paymentStatus', 'errorCode']);
      if (!isPaidStatus(status)) continue;
      const ok = await markPaidByDetail(rec as Record<string, unknown>, decoded);
      if (ok) synced += 1;
    } catch {
      // skip single record and continue
    }
  }
  if (synced > 0) {
    console.log(`[VA_SYNC_POLLER] synced=${synced}`);
  }
}

export function startVaSyncPoller() {
  const g = globalThis as typeof globalThis & { [POLLER_KEY]?: boolean };
  if (g[POLLER_KEY]) return;
  g[POLLER_KEY] = true;

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await syncSweep();
    } catch (e) {
      console.error('[VA_SYNC_POLLER] error:', e);
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, pollIntervalMs());
}

