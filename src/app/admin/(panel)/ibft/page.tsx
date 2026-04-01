'use client';

import { useEffect, useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass, fieldSelectClass } from '@/components/ui';
import { IBFT_BANKS } from '@/lib/banks';

type WithdrawalItem = {
  id?: string;
  mongoId?: string;
  bankCode?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  amount?: number;
  actualReceive?: number;
  status?: string;
  createdAt?: number;
};

function mapBankCodeFromName(bankName: string) {
  const needle = String(bankName || '').trim().toLowerCase();
  if (!needle) return '';
  const exact = IBFT_BANKS.find((b) => b.name.toLowerCase() === needle);
  if (exact) return exact.code;
  const byContain = IBFT_BANKS.find(
    (b) =>
      b.name.toLowerCase().includes(needle) ||
      needle.includes(b.name.toLowerCase()) ||
      b.code.toLowerCase() === needle,
  );
  return byContain?.code || '';
}

export default function AdminIbftPage() {
  const [bankCode, setBankCode] = useState('');
  const [bankKeyword, setBankKeyword] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [sourceBank, setSourceBank] = useState<'MSB' | 'KLB' | ''>('');
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);
  const bankOptions = IBFT_BANKS.filter((b) => {
    const q = bankKeyword.trim().toLowerCase();
    if (!q) return true;
    return b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
  });

  async function loadPendingWithdrawals() {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch('/api/admin/withdrawals?status=pending');
      const j = await res.json();
      setWithdrawals(Array.isArray(j.items) ? (j.items as WithdrawalItem[]) : []);
    } finally {
      setLoadingWithdrawals(false);
    }
  }

  useEffect(() => {
    void loadPendingWithdrawals();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOut('');
    try {
      const res = await fetch('/api/ibft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankCode,
          accountNumber,
          accountName,
          amount,
          remark: remark || undefined,
          sourceBank: sourceBank || undefined,
          withdrawalId: selectedWithdrawal?.id ? String(selectedWithdrawal.id) : undefined,
          withdrawalMongoId: selectedWithdrawal?.mongoId ? String(selectedWithdrawal.mongoId) : undefined,
        }),
      });
      const j = await res.json();
      setOut(JSON.stringify(j, null, 2));
      if (j?.autoHandled?.updated) {
        setSelectedWithdrawal(null);
        await loadPendingWithdrawals();
      }
    } finally {
      setLoading(false);
    }
  }

  function pickWithdrawal(w: WithdrawalItem) {
    setSelectedWithdrawal(w);
    const code = String(w.bankCode || '').trim().toUpperCase() || mapBankCodeFromName(String(w.bankName || ''));
    const net = Number(w.actualReceive || 0);
    const raw = Number(w.amount || 0);
    const amountToUse = net > 0 ? net : raw;
    setBankCode(code);
    setBankKeyword('');
    setAccountNumber(String(w.bankAccount || '').trim());
    setAccountName(String(w.bankHolder || '').trim());
    setAmount(amountToUse > 0 ? String(Math.floor(amountToUse)) : '');
    setRemark(`Chi ho rut ${String(w.id || '').trim()}`.trim());
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sinpay API"
        title="Chi hộ IBFT"
        description="Firm transfer môi trường thật. Nhập trực tiếp thông tin người nhận và chọn kênh nguồn theo cấu hình thật."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <Card padding="lg">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <FieldLabel>Kênh nguồn (tùy chọn)</FieldLabel>
              <select
                value={sourceBank}
                onChange={(e) => setSourceBank(e.target.value as typeof sourceBank)}
                className={fieldSelectClass}
              >
                <option value="MSB">MSB</option>
                <option value="KLB">KLB</option>
                <option value="">Mặc định merchant chính</option>
              </select>
            </div>
            <div>
              <FieldLabel>Mã NH đích</FieldLabel>
              <div className="space-y-2">
                <input
                  placeholder="Tìm ngân hàng (VCB, Vietcombank...)"
                  value={bankKeyword}
                  onChange={(e) => setBankKeyword(e.target.value)}
                  className={fieldInputClass}
                />
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                  className={fieldSelectClass}
                  required
                >
                  <option value="">-- Chọn ngân hàng đích --</option>
                  {bankOptions.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>Số tài khoản</FieldLabel>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={fieldInputClass}
                required
              />
            </div>
            <div>
              <FieldLabel>Tên chủ TK</FieldLabel>
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={fieldInputClass} required />
            </div>
            <div>
              <FieldLabel>Số tiền</FieldLabel>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} required />
            </div>
            <div>
              <FieldLabel>Ghi chú</FieldLabel>
              <input value={remark} onChange={(e) => setRemark(e.target.value)} className={fieldInputClass} />
            </div>
            {selectedWithdrawal ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Đang liên kết lệnh rút #{String(selectedWithdrawal.id || selectedWithdrawal.mongoId || '—')} — chi hộ thành công sẽ tự duyệt.
              </p>
            ) : null}
            <Button type="submit" disabled={loading}>
              Gửi chi hộ
            </Button>
          </form>
        </Card>

        <Card padding="lg" variant="quiet">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Danh sách yêu cầu rút tiền</h2>
              <Button type="button" variant="secondary" onClick={() => void loadPendingWithdrawals()} disabled={loadingWithdrawals}>
                Làm mới
              </Button>
            </div>
            <p className="text-sm text-slate-500">Bấm chọn một yêu cầu để tự điền thông tin sang form chi hộ.</p>
            <div className="max-h-[540px] space-y-3 overflow-auto pr-1">
              {withdrawals.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  {loadingWithdrawals ? 'Đang tải danh sách...' : 'Không có yêu cầu rút đang chờ.'}
                </p>
              ) : (
                withdrawals.map((w, idx) => (
                  <button
                    key={String(w.id || `wd-${idx}`)}
                    type="button"
                    onClick={() => pickWithdrawal(w)}
                    className={`w-full rounded-2xl border bg-gradient-to-br px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      String(selectedWithdrawal?.id || selectedWithdrawal?.mongoId || '') ===
                      String(w.id || w.mongoId || '')
                        ? 'border-emerald-300 from-emerald-50 via-white to-sky-50 ring-2 ring-emerald-200/70'
                        : 'border-sky-100 from-white via-sky-50/40 to-emerald-50/30 hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">#{String(w.id || '—')}</p>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        Chờ duyệt
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-sky-700">
                      {String(w.bankCode || mapBankCodeFromName(String(w.bankName || '')) || 'N/A')} · {String(w.bankName || 'N/A')}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {String(w.bankAccount || 'N/A')} · {String(w.bankHolder || 'N/A')}
                    </p>
                    <p className="mt-2 text-xs">
                      <span className="font-semibold text-rose-600">
                        Số tiền: {Number(w.amount || 0).toLocaleString('vi-VN')}đ
                      </span>
                      <span className="mx-1.5 text-slate-400">·</span>
                      <span className="font-semibold text-emerald-600">
                        Thực nhận: {Number(w.actualReceive || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {out ? (
        <pre className="mt-8 max-h-96 overflow-auto rounded-[var(--radius-app-lg)] border border-slate-200 bg-surface-2/90 p-5 font-mono text-xs leading-relaxed text-slate-700 shadow-inner-glow">
          {out}
        </pre>
      ) : null}
    </div>
  );
}
