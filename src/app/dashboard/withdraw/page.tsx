'use client';

import { useEffect, useMemo, useState } from 'react';
import { IBFT_BANK_PICK_CODES, getIbftBankLabel, findIbftBanks } from '@/lib/banks';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass } from '@/components/ui';

type SavedWithdrawAccount = {
  bankCode: string;
  bankAccount: string;
  bankHolder: string;
  updatedAt: number;
};

export default function WithdrawPage() {
  const [query, setQuery] = useState('');
  const [bankCode, setBankCode] = useState('VCB');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState<SavedWithdrawAccount[]>([]);
  const [feeInfo, setFeeInfo] = useState<{ feePercent: number; ipnFeeFlat: number; withdrawFeeFlat: number } | null>(
    null,
  );
  const [savedLoading, setSavedLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(() => findIbftBanks(query, 10), [query]);
  const quick = useMemo(
    () => IBFT_BANK_PICK_CODES.map((c) => ({ code: c, name: getIbftBankLabel(c) })),
    [],
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setSavedLoading(true);
      try {
        const res = await fetch('/api/withdraw/saved');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !mounted) return;
        setSaved(Array.isArray(data.items) ? data.items : []);
      } finally {
        if (mounted) setSavedLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch('/api/me');
        const data = await res.json().catch(() => ({}));
        const user = (data && data.user) || {};
        if (!mounted || !user || typeof user !== 'object') return;
        setFeeInfo({
          feePercent: Number(user.feePercent || 0),
          ipnFeeFlat: Number(user.ipnFeeFlat || 0),
          withdrawFeeFlat: Number(user.withdrawFeeFlat || 0),
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankCode,
          bankAccount,
          bankHolder,
          amount: Number(amount.replace(/\D/g, '')),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Lỗi');
        return;
      }
      setMsg(`Đã tạo yêu cầu ${data.id}. Thực nhận ~${data.actualReceive?.toLocaleString('vi-VN')}đ`);
      setSaved((prev) => {
        const next: SavedWithdrawAccount = {
          bankCode,
          bankAccount: bankAccount.replace(/[^\d]/g, '').slice(0, 24),
          bankHolder: bankHolder.trim(),
          updatedAt: Date.now(),
        };
        const dedup = prev.filter((r) => !(r.bankCode === next.bankCode && r.bankAccount === next.bankAccount));
        return [next, ...dedup].slice(0, 8);
      });
      setAmount('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Thanh toán"
        title="Rút tiền"
        description="Số dư sẽ bị trừ ngay khi gửi; admin duyệt lệnh ở trang quản trị."
      />

      <div className="mb-6">
        <Card padding="md" variant="quiet" className="max-w-[560px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Phí áp dụng</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-500">% Phí rút</p>
              <p className="text-sm font-semibold text-amber-700">{Number(feeInfo?.feePercent || 0)}%</p>
            </div>
            <div className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-500">Phí giao dịch</p>
              <p className="text-sm font-semibold text-rose-700">
                {Number(feeInfo?.ipnFeeFlat || 0).toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-500">Phí rút cố định</p>
              <p className="text-sm font-semibold text-emerald-700">
                {Number(feeInfo?.withdrawFeeFlat || 0).toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,560px)_minmax(280px,1fr)]">
        <Card padding="lg">
          <form onSubmit={submit} className="space-y-6">
            <div>
            <FieldLabel>Ngân hàng</FieldLabel>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm VCB, Vietcombank…"
              className={`${fieldInputClass} py-2.5 text-sm`}
            />
            {suggestions.length > 0 && (
              <ul className="mt-2 max-h-36 overflow-auto rounded-[var(--radius-app)] border border-slate-200 bg-white text-sm shadow-card">
                {suggestions.map((b) => (
                  <li key={b.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setBankCode(b.code);
                        setQuery(`${b.code} — ${b.name}`);
                      }}
                      className="w-full px-3 py-2.5 text-left text-slate-700 transition hover:bg-slate-50"
                    >
                      {b.code} — {b.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">Đang chọn mã: {bankCode}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {quick.slice(0, 16).map((b) => (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => setBankCode(b.code)}
                  className={`rounded-[var(--radius-app)] px-2.5 py-1.5 text-xs font-medium transition ${
                    bankCode === b.code
                      ? 'bg-accent/15 text-accent ring-1 ring-accent/25'
                      : 'border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
                  }`}
                >
                  {b.code}
                </button>
              ))}
            </div>
            </div>
            <div>
              <FieldLabel>Số tài khoản</FieldLabel>
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className={fieldInputClass}
                required
              />
            </div>
            <div>
              <FieldLabel>Chủ tài khoản</FieldLabel>
              <input
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                className={fieldInputClass}
                required
              />
            </div>
            <div>
              <FieldLabel>Số tiền (đ)</FieldLabel>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={fieldInputClass}
                placeholder="500000"
                required
              />
            </div>
            {msg ? (
              <p
                className={`text-sm font-medium ${msg.startsWith('Đã tạo') ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {msg}
              </p>
            ) : null}
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </Button>
          </form>
        </Card>

        <Card padding="lg" className="h-fit">
          <div className="space-y-3">
            <FieldLabel>Tài khoản đã lưu</FieldLabel>
            <p className="text-xs text-slate-500">Bấm để điền nhanh ngân hàng, STK và chủ tài khoản.</p>
            {savedLoading ? (
              <p className="text-sm text-slate-500">Đang tải...</p>
            ) : saved.length ? (
              <div className="space-y-2">
                {saved.map((it) => (
                  <button
                    key={`${it.bankCode}-${it.bankAccount}`}
                    type="button"
                    onClick={() => {
                      setBankCode(it.bankCode);
                      setQuery(`${it.bankCode} — ${getIbftBankLabel(it.bankCode)}`);
                      setBankAccount(it.bankAccount);
                      setBankHolder(it.bankHolder);
                    }}
                    className="w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="font-medium">{it.bankCode}</span> - {it.bankAccount} ({it.bankHolder})
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có tài khoản lưu. Tạo lệnh rút đầu tiên để lưu tự động.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
