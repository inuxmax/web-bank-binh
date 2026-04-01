'use client';

import { useEffect, useMemo, useState } from 'react';

type Preset = 'day' | 'week' | 'month' | 'year' | 'custom';

type Totals = {
  totalVaCreated: number;
  totalTransactionAmount: number;
  totalIbftAmount: number;
  totalUsers: number;
  totalCtv: number;
  platformFeeAmount: number;
  totalProfit: number;
};

function ymdNow() {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function AdminStatsOverview() {
  const [preset, setPreset] = useState<Preset>('day');
  const [fromDate, setFromDate] = useState(ymdNow());
  const [toDate, setToDate] = useState(ymdNow());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [totals, setTotals] = useState<Totals>({
    totalVaCreated: 0,
    totalTransactionAmount: 0,
    totalIbftAmount: 0,
    totalUsers: 0,
    totalCtv: 0,
    platformFeeAmount: 0,
    totalProfit: 0,
  });

  const query = useMemo(() => {
    const q = new URLSearchParams({ preset });
    if (preset === 'custom') {
      q.set('from', fromDate);
      q.set('to', toDate);
    }
    return q.toString();
  }, [preset, fromDate, toDate]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErr('');
      try {
        const res = await fetch(`/api/admin/stats/summary?${query}`, { cache: 'no-store' });
        const j = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok) {
          setErr(String(j.error || 'Không tải được thống kê'));
          return;
        }
        setTotals({
          totalVaCreated: Number(j?.totals?.totalVaCreated || 0),
          totalTransactionAmount: Number(j?.totals?.totalTransactionAmount || 0),
          totalIbftAmount: Number(j?.totals?.totalIbftAmount || 0),
          totalUsers: Number(j?.totals?.totalUsers || 0),
          totalCtv: Number(j?.totals?.totalCtv || 0),
          platformFeeAmount: Number(j?.totals?.platformFeeAmount || 0),
          totalProfit: Number(j?.totals?.totalProfit || 0),
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [query]);

  return (
    <div className="mb-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'day', label: 'Ngày' },
          { key: 'week', label: 'Tuần' },
          { key: 'month', label: 'Tháng' },
          { key: 'year', label: 'Năm' },
          { key: 'custom', label: 'Tùy chọn ngày' },
        ].map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setPreset(x.key as Preset)}
            className={`rounded-[var(--radius-app)] px-3 py-1.5 text-xs font-medium ${
              preset === x.key
                ? 'bg-accent text-on-accent'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {x.label}
          </button>
        ))}
        {preset === 'custom' ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            />
            <span className="text-xs text-slate-500">đến</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            />
          </div>
        ) : null}
      </div>

      {err ? <p className="text-sm text-rose-500">{err}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[var(--radius-app-lg)] border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Tổng VA tạo</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '...' : totals.totalVaCreated.toLocaleString('vi-VN')}</p>
        </div>
        <div className="rounded-[var(--radius-app-lg)] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Tổng tiền giao dịch</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {loading ? '...' : `${totals.totalTransactionAmount.toLocaleString('vi-VN')} đ`}
          </p>
        </div>
        <div className="rounded-[var(--radius-app-lg)] border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">Tổng tiền chi hộ</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '...' : `${totals.totalIbftAmount.toLocaleString('vi-VN')} đ`}</p>
        </div>
        <div className="rounded-[var(--radius-app-lg)] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">Tổng số user</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '...' : totals.totalUsers.toLocaleString('vi-VN')}</p>
        </div>
        <div className="rounded-[var(--radius-app-lg)] border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-700">Lãi</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '...' : `${totals.totalProfit.toLocaleString('vi-VN')} đ`}</p>
          <p className="mt-1 text-[11px] text-rose-700/80">= Giao dịch - Chi hộ - Phí sàn 3%</p>
        </div>
      </div>
    </div>
  );
}
