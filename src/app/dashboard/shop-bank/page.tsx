'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass } from '@/components/ui';

type BankRow = {
  bankCode: string;
  stockCount: number;
  minPrice: number;
  maxPrice: number;
};

type PurchaseItem = {
  holderName: string;
  accountNumber: string;
  bankCode: string;
  price: number;
};

type Purchase = {
  saleId: string;
  bankCode: string;
  quantity: number;
  totalAmount: number;
  createdAt: number;
  items: PurchaseItem[];
};

function fmtVnd(n: number) {
  return `${Number(n || 0).toLocaleString('vi-VN')} đ`;
}

export default function ShopBankPage() {
  const [banks, setBanks] = useState<BankRow[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState('');

  const selected = useMemo(
    () => banks.find((b) => b.bankCode === bankCode) || null,
    [banks, bankCode],
  );
  const estimate = Number(selected?.minPrice || 0) * Number(quantity || 0);
  const banksCount = banks.length;

  async function load() {
    setLoading(true);
    const res = await fetch('/api/shop-bank', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      const nextBanks = Array.isArray(d.banks) ? d.banks : [];
      setBanks(nextBanks);
      setPurchases(Array.isArray(d.purchases) ? d.purchases : []);
      setBalance(Number(d.balance || 0));
      if (!bankCode && nextBanks.length) setBankCode(String(nextBanks[0].bankCode || ''));
    } else {
      setMsg(String(d.error || 'Không tải được dữ liệu shop'));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!bankCode) {
      setMsg('Vui lòng chọn ngân hàng');
      return;
    }
    setBuying(true);
    try {
      const res = await fetch('/api/shop-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankCode, quantity: Number(quantity || 0) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(d.error || 'Mua thất bại'));
        return;
      }
      const sale: Purchase = {
        saleId: String(d.saleId || ''),
        bankCode: String(bankCode),
        quantity: Number(d.quantity || 0),
        totalAmount: Number(d.totalAmount || 0),
        createdAt: Date.now(),
        items: Array.isArray(d.items) ? d.items : [],
      };
      setPurchases((prev) => [sale, ...prev].slice(0, 30));
      setBalance(Number(d.balance || 0));
      setMsg(`Mua thành công ${sale.quantity} tài khoản (${sale.totalAmount.toLocaleString('vi-VN')} đ)`);
      await load();
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shop"
        title="Shop bank"
        description="Mua tài khoản theo ngân hàng, hệ thống tự lấy ngẫu nhiên từ kho và trừ tiền trực tiếp."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card padding="md" className="border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-[11px] uppercase tracking-wider text-emerald-700">Số dư hiện tại</p>
          <p className="mt-1 text-lg font-semibold text-emerald-800">{fmtVnd(balance)}</p>
        </Card>
        <Card padding="md" className="border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white">
          <p className="text-[11px] uppercase tracking-wider text-sky-700">Ngân hàng trong kho</p>
          <p className="mt-1 text-lg font-semibold text-sky-800">{banksCount.toLocaleString('vi-VN')}</p>
        </Card>
        <Card padding="md" className="border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white">
          <p className="text-[11px] uppercase tracking-wider text-amber-700">Tồn kho {selected?.bankCode || ''}</p>
          <p className="mt-1 text-lg font-semibold text-amber-800">
            {Number(selected?.stockCount || 0).toLocaleString('vi-VN')}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <Card padding="lg" className="border border-slate-200/90 bg-white/95 shadow-card">
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <FieldLabel>Chọn ngân hàng</FieldLabel>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className={fieldInputClass}
                required
              >
                {!banks.length ? <option value="">Chưa có tồn kho</option> : null}
                {banks.map((b) => (
                  <option key={b.bankCode} value={b.bankCode}>
                    {b.bankCode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Nhập số lượng</FieldLabel>
              <input
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value || 1))}
                className={fieldInputClass}
              />
              <div className="mt-2 flex items-center gap-2">
                {[1, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`rounded-md border px-2 py-1 text-xs transition ${
                      quantity === n
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius-app)] border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-2 text-sm">
              <p>
                Tồn kho ({selected?.bankCode || '—'}):{' '}
                <span className="font-semibold">{Number(selected?.stockCount || 0).toLocaleString('vi-VN')}</span>
              </p>
              <p>
                Giá/tài khoản:{' '}
                <span className="font-semibold">
                  {Number(selected?.minPrice || 0).toLocaleString('vi-VN')}
                  {selected && selected.maxPrice !== selected.minPrice
                    ? ` - ${Number(selected.maxPrice || 0).toLocaleString('vi-VN')}`
                    : ''}{' '}
                  đ
                </span>
              </p>
              <p>
                Tạm tính: <span className="font-semibold text-emerald-700">{estimate.toLocaleString('vi-VN')} đ</span>
              </p>
            </div>

            {msg ? (
              <p
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  msg.toLowerCase().startsWith('mua thành công')
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {msg}
              </p>
            ) : null}

            <Button type="submit" disabled={buying || !banks.length}>
              {buying ? 'Đang mua...' : 'Mua ngay'}
            </Button>
          </form>
        </Card>

        <Card padding="lg" className="border border-slate-200/90 bg-white/95 shadow-card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Lịch sử mua gần đây</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Đang tải...</p>
          ) : purchases.length ? (
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {purchases.map((p) => (
                <div
                  key={p.saleId}
                  className="rounded-[var(--radius-app)] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {p.bankCode} · {p.quantity} tài khoản · {fmtVnd(Number(p.totalAmount || 0))}
                    </p>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      #{p.saleId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{new Date(p.createdAt || Date.now()).toLocaleString('vi-VN')}</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    {p.items?.map((it, idx) => (
                      <p key={`${p.saleId}-${idx}`} className="rounded bg-white/90 px-2 py-1 font-mono">
                        {it.holderName}|{it.accountNumber}|{it.bankCode}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa có giao dịch mua nào.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
