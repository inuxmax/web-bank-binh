'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass } from '@/components/ui';

type BankRow = {
  bankCode: string;
  stockCount: number;
  minPrice: number;
  maxPrice: number;
};

type StatsPayload = {
  fromTs: number;
  toTs: number;
  totals: { soldCount: number; revenue: number };
  banks: BankRow[];
};

type Preset = 'day' | 'week' | 'month' | 'year' | 'custom';

export default function AdminShopBankPage() {
  const [rows, setRows] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [banks, setBanks] = useState<BankRow[]>([]);
  const [preset, setPreset] = useState<Preset>('day');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const stockTotal = useMemo(
    () => banks.reduce((s, x) => s + Number(x.stockCount || 0), 0),
    [banks],
  );

  async function loadInventory() {
    const res = await fetch('/api/admin/shop-bank', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setBanks(Array.isArray(d.banks) ? d.banks : []);
  }

  async function loadStats() {
    setLoadingStats(true);
    const query = new URLSearchParams({ preset });
    if (preset === 'custom' && from && to) {
      query.set('from', from);
      query.set('to', to);
    }
    const res = await fetch(`/api/admin/shop-bank/stats?${query.toString()}`, { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setStats(d);
      setBanks(Array.isArray(d.banks) ? d.banks : []);
    } else {
      setMsg(String(d.error || 'Không tải được thống kê'));
    }
    setLoadingStats(false);
  }

  useEffect(() => {
    void loadInventory();
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/shop-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          price: Number(String(price).replace(/[^\d]/g, '')),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(d.error || 'Upload thất bại'));
        return;
      }
      setMsg(`Upload xong: ${d.inserted}/${d.requested} tài khoản (bỏ qua ${d.skipped}).`);
      setRows('');
      await loadInventory();
      await loadStats();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Shop bank"
        description="Up kho tài khoản bank, set giá và theo dõi doanh thu bán tài khoản."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="md" variant="quiet">
          <p className="text-xs uppercase tracking-wider text-slate-500">Tồn kho</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stockTotal.toLocaleString('vi-VN')}</p>
        </Card>
        <Card padding="md" variant="quiet">
          <p className="text-xs uppercase tracking-wider text-slate-500">Số lượng đã bán</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {Number(stats?.totals?.soldCount || 0).toLocaleString('vi-VN')}
          </p>
        </Card>
        <Card padding="md" variant="quiet">
          <p className="text-xs uppercase tracking-wider text-slate-500">Doanh thu</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">
            {Number(stats?.totals?.revenue || 0).toLocaleString('vi-VN')} đ
          </p>
        </Card>
      </div>

      <Card padding="lg">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Upload tài khoản</h3>
        <form className="space-y-4" onSubmit={submitUpload}>
          <div>
            <FieldLabel>Giá mỗi tài khoản (đ)</FieldLabel>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={fieldInputClass}
              placeholder="10000"
              required
            />
          </div>
          <div>
            <FieldLabel>Danh sách tài khoản (mỗi dòng 1 tài khoản)</FieldLabel>
            <textarea
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              className={`${fieldInputClass} min-h-[200px] font-mono text-xs`}
              placeholder="NGUYEN THANH TOAN|00553456666688|MB"
              required
            />
            <p className="mt-1 text-xs text-slate-500">Định dạng: TEN_CHU_TK|SO_TK|MA_BANK (ví dụ MB)</p>
          </div>
          {msg ? <p className="text-sm font-medium text-emerald-600">{msg}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang upload...' : 'Upload vào kho'}
          </Button>
        </form>
      </Card>

      <Card padding="lg">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Thống kê doanh thu</h3>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className={fieldInputClass}>
            <option value="day">Ngày</option>
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
            <option value="year">Năm</option>
            <option value="custom">Chọn ngày cụ thể</option>
          </select>
          {preset === 'custom' ? (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldInputClass} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldInputClass} />
              <Button type="button" onClick={() => void loadStats()}>
                Áp dụng
              </Button>
            </>
          ) : null}
        </div>

        {loadingStats ? <p className="text-sm text-slate-500">Đang tải...</p> : null}

        <div className="overflow-x-auto rounded-[var(--radius-app)] border border-slate-200 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">Bank</th>
                <th className="p-3">Tồn kho</th>
                <th className="p-3">Giá min</th>
                <th className="p-3">Giá max</th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.bankCode} className="border-b border-slate-100">
                  <td className="p-3 font-semibold">{b.bankCode}</td>
                  <td className="p-3">{Number(b.stockCount || 0).toLocaleString('vi-VN')}</td>
                  <td className="p-3">{Number(b.minPrice || 0).toLocaleString('vi-VN')} đ</td>
                  <td className="p-3">{Number(b.maxPrice || 0).toLocaleString('vi-VN')} đ</td>
                </tr>
              ))}
              {!banks.length ? (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={4}>
                    Chưa có dữ liệu kho.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
