'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, PageHeader } from '@/components/ui';

type BalancePayload = {
  merchantId?: string | number;
  merchantEmail?: string;
  balance?: string | number;
  availableBalance?: string | number;
  [key: string]: unknown;
};

function toBalanceNumber(v: unknown) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function AdminBalancePage() {
  const [data, setData] = useState<BalancePayload | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    setErr('');
    if (silent) setSyncing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/account/balance');
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Lỗi');
        return;
      }
      const raw = (j.decoded ?? j.raw) as BalancePayload;
      setData(typeof raw === 'object' && raw !== null ? raw : { value: raw });
      setLastSyncedAt(Date.now());
    } finally {
      if (silent) setSyncing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load({ silent: true });
    }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const currentBalance = toBalanceNumber(data?.balance ?? data?.availableBalance);

  return (
    <div>
      <PageHeader
        eyebrow="Sinpay API"
        title="Số dư Sinpay"
        description="Tự động đồng bộ mỗi 30 giây từ API get-balance."
        actions={
          <Button type="button" onClick={() => void load()} disabled={loading || syncing} variant="primary" size="sm">
            {loading ? 'Đang gọi…' : syncing ? 'Đang đồng bộ…' : 'Tra cứu ngay'}
          </Button>
        }
      />
      {err ? <p className="mb-4 text-sm font-medium text-rose-400">{err}</p> : null}
      {!data ? (
        <p className="text-sm text-slate-500">{loading ? 'Đang tải số dư…' : 'Chưa có dữ liệu số dư.'}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-app-lg)] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Số dư hiện tại</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{currentBalance.toLocaleString('vi-VN')} đ</p>
            </div>
            <div className="rounded-[var(--radius-app-lg)] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Merchant ID</p>
              <p className="mt-2 font-mono text-sm text-slate-800">{String(data.merchantId ?? '—')}</p>
            </div>
            <div className="rounded-[var(--radius-app-lg)] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Merchant Email</p>
              <p className="mt-2 text-sm text-slate-800">{String(data.merchantEmail ?? '—')}</p>
            </div>
            <div className="rounded-[var(--radius-app-lg)] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Lần đồng bộ gần nhất</p>
              <p className="mt-2 text-sm text-slate-800">
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('vi-VN') : '—'}
              </p>
            </div>
          </div>

          <details className="rounded-[var(--radius-app-lg)] border border-slate-200 bg-surface-2/80 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Xem dữ liệu raw từ API</summary>
            <pre className="mt-3 overflow-auto rounded-lg bg-white p-4 font-mono text-xs leading-relaxed text-slate-700">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
