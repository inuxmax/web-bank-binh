import 'server-only';

import * as db from '@/lib/server/db';
import { getBankOverrides, getTransactionDetail, inquireVirtualAccount } from './hpay';

const POLLER_KEY = '__sinpayVaSyncPollerStarted' as const;
const POLLER_STATUS_KEY = '__sinpayVaSyncPollerStatus' as const;

type VaSyncStatus = {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  limit: number;
  lastRunAt: number;
  lastDurationMs: number;
  lastChecked: number;
  lastSynced: number;
  totalSynced: number;
  lastError: string;
};

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

function getStatusStore(): VaSyncStatus {
  const g = globalThis as typeof globalThis & { [POLLER_STATUS_KEY]?: VaSyncStatus };
  if (!g[POLLER_STATUS_KEY]) {
    g[POLLER_STATUS_KEY] = {
      enabled: true,
      running: false,
      intervalMs: pollIntervalMs(),
      limit: pollLimit(),
      lastRunAt: 0,
      lastDurationMs: 0,
      lastChecked: 0,
      lastSynced: 0,
      totalSynced: 0,
      lastError: '',
    };
  }
  return g[POLLER_STATUS_KEY]!;
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

function normalizeSourceCode(raw: string): string {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'MSB' || s.includes('MARITIME')) return 'MSB';
  if (s === 'KLB' || s.includes('KIENLONG')) return 'KLB';
  return s;
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

async function syncSweep(): Promise<{ checked: number; synced: number }> {
  const rows = await db.loadAll();
  const pending = rows
    .filter((r) => String(r.status || '').trim() !== 'paid')
    .sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0))
    .slice(0, pollLimit());

  let synced = 0;
  for (const rec of pending) {
    const clientRequestId = String(rec.parentRequestId || rec.requestId || '').trim();
    if (!clientRequestId) continue;
    const bankCode = normalizeSourceCode(String(rec.vaBank || ''));
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
      const vaAccount = String(rec.vaAccount || '').trim();
      const vaInquiry = vaAccount
        ? await inquireVirtualAccount({
            vaAccount,
            merchantIdOverride: ov.midOverride,
            passcodeOverride: ov.passOverride,
            clientIdOverride: ov.clientIdOverride,
            clientSecretOverride: ov.clientSecretOverride,
            xApiMidOverride: ov.xApiMidOverride,
          }).catch(() => null)
        : null;

      const detailStatus = decoded ? pick(decoded, ['status', 'tranStatus', 'paymentStatus', 'errorCode']) : '';
      const inquiryStatus = vaInquiry?.decoded
        ? pick(vaInquiry.decoded as Record<string, unknown>, ['status', 'tranStatus', 'paymentStatus', 'errorCode'])
        : '';
      const paidByDetail = decoded && isPaidStatus(detailStatus);
      const paidByInquiry = vaInquiry?.decoded && isPaidStatus(inquiryStatus);
      if (!paidByDetail && !paidByInquiry) continue;
      const merged = {
        ...(vaInquiry?.decoded || {}),
        ...(decoded || {}),
      } as Record<string, unknown>;
      const ok = await markPaidByDetail(rec as Record<string, unknown>, merged);
      if (ok) synced += 1;
    } catch {
      // skip single record and continue
    }
  }
  if (synced > 0) {
    console.log(`[VA_SYNC_POLLER] synced=${synced}`);
  }
  return { checked: pending.length, synced };
}

export function startVaSyncPoller() {
  const g = globalThis as typeof globalThis & { [POLLER_KEY]?: boolean };
  if (g[POLLER_KEY]) return;
  g[POLLER_KEY] = true;

  let running = false;
  const status = getStatusStore();
  status.enabled = true;
  status.intervalMs = pollIntervalMs();
  status.limit = pollLimit();
  const run = async () => {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    status.running = true;
    status.lastError = '';
    try {
      const before = Date.now();
      const result = await syncSweep();
      status.lastRunAt = Date.now();
      status.lastDurationMs = status.lastRunAt - before;
      status.lastChecked = result.checked;
      status.lastSynced = result.synced;
      status.totalSynced += result.synced;
    } catch (e) {
      status.lastError = e instanceof Error ? e.message : String(e);
      console.error('[VA_SYNC_POLLER] error:', e);
    } finally {
      running = false;
      status.running = false;
      if (!status.lastRunAt) status.lastRunAt = startedAt;
      status.lastDurationMs = Date.now() - startedAt;
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, pollIntervalMs());
}

export function getVaSyncStatus() {
  return getStatusStore();
}

