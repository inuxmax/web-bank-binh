'use client';

import { useEffect, useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass, fieldSelectClass } from '@/components/ui';
import { IBFT_BANKS } from '@/lib/banks';

type WithdrawalItem = {
  id?: string;
  mongoId?: string;
  userId?: string;
  username?: string;
  bankCode?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  amount?: number;
  actualReceive?: number;
  status?: string;
  createdAt?: number;
  isVerified?: boolean;
  isScam?: boolean;
};

type IbftHistoryItem = {
  ts?: number;
  userId?: string;
  username?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  amount?: number;
  orderId?: string;
  tranStatus?: string;
  errorCode?: string;
  errorMessage?: string;
  remark?: string;
};

type IbftSubmitResult = {
  ok: boolean;
  title: string;
  detail: string;
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
  const [result, setResult] = useState<IbftSubmitResult | null>(null);
  const [history, setHistory] = useState<IbftHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const bankOptions = IBFT_BANKS.filter((b) => {
    const q = bankKeyword.trim().toLowerCase();
    if (!q) return true;
    return b.code.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
  });

  async function loadPendingWithdrawals() {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=pending&_ts=${Date.now()}`, { cache: 'no-store' });
      const j = await res.json();
      const rows = Array.isArray(j.items) ? (j.items as WithdrawalItem[]) : [];
      setWithdrawals(
        rows.filter((x) => {
          const hasRef = Boolean(String(x.id || x.mongoId || '').trim());
          const hasUser = Boolean(String(x.userId || '').trim()) && Boolean(String(x.username || '').trim());
          return hasRef && hasUser;
        }),
      );
    } finally {
      setLoadingWithdrawals(false);
    }
  }

  useEffect(() => {
    void loadPendingWithdrawals();
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/admin/ibft-history?limit=500');
      const j = await res.json().catch(() => ({}));
      const rows = Array.isArray(j.items) ? (j.items as IbftHistoryItem[]) : [];
      setHistory(
        rows.filter((x) => Boolean(String(x.userId || '').trim()) && Boolean(String(x.username || '').trim())),
      );
      setHistoryPage(1);
    } finally {
      setLoadingHistory(false);
    }
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const hasLinked = Boolean(String(selectedWithdrawal?.id || selectedWithdrawal?.mongoId || '').trim());
    const hasUser = Boolean(String(selectedWithdrawal?.userId || '').trim()) && Boolean(String(selectedWithdrawal?.username || '').trim());
    if (!hasLinked || !hasUser) {
      setResult({
        ok: false,
        title: 'Thiếu liên kết lệnh rút',
        detail: 'Vui lòng chọn đúng yêu cầu có ID và USER từ danh sách bên phải.',
      });
      return;
    }
    setLoading(true);
    setResult(null);
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
      const code = String(j?.raw?.errorCode || '').trim();
      const msg = String(j?.raw?.errorMessage || '').trim();
      const ibftOk = code === '00' || String(j?.autoHandled?.status || '') === 'done';
      if (ibftOk) {
        const selectedKey = String(selectedWithdrawal?.id || selectedWithdrawal?.mongoId || '');
        if (selectedKey) {
          setWithdrawals((prev) =>
            prev.filter((x) => String(x.id || x.mongoId || '') !== selectedKey),
          );
        }
        setResult({
          ok: true,
          title: 'Đã chi hộ thành công',
          detail: `Mã phản hồi: ${code || '00'}${msg ? ` · ${msg}` : ''}`,
        });
        setSelectedWithdrawal(null);
        setBankCode('');
        setBankKeyword('');
        setAccountNumber('');
        setAccountName('');
        setAmount('');
        setRemark('');
        setCooldownSeconds(5);
        for (let i = 5; i > 0; i -= 1) {
          setCooldownSeconds(i);
          // eslint-disable-next-line no-await-in-loop
          await sleep(1000);
        }
        await loadPendingWithdrawals();
        setCooldownSeconds(0);
      } else {
        setResult({
          ok: false,
          title: 'Chi hộ thất bại',
          detail: `${code || 'N/A'}${msg ? ` · ${msg}` : ''}`,
        });
      }
      if (j?.autoHandled?.updated) {
        setSelectedWithdrawal(null);
      }
      await loadHistory();
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

  const selectedKey = String(selectedWithdrawal?.id || selectedWithdrawal?.mongoId || '');
  const pendingCount = withdrawals.length;
  const pendingVerified = withdrawals.filter((x) => Boolean(x.isVerified)).length;
  const pendingScam = withdrawals.filter((x) => Boolean(x.isScam)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sinpay API"
        title="Chi hộ IBFT"
        description="Firm transfer môi trường thật. Nhập trực tiếp thông tin người nhận và chọn kênh nguồn theo cấu hình thật."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-200/80 bg-emerald-50/60" padding="sm">
          <p className="text-xs text-emerald-700">Yêu cầu đang chờ</p>
          <p className="text-xl font-semibold text-emerald-800">{pendingCount}</p>
        </Card>
        <Card className="border-rose-200/80 bg-rose-50/60" padding="sm">
          <p className="text-xs text-rose-700">User verify đang chờ</p>
          <p className="text-xl font-semibold text-rose-800">{pendingVerified}</p>
        </Card>
        <Card className="border-sky-200/80 bg-sky-50/60" padding="sm">
          <p className="text-xs text-sky-700">Đang chọn</p>
          <p className="truncate font-mono text-sm font-semibold text-sky-800">{selectedKey || 'Chưa chọn'}</p>
        </Card>
        <Card className="border-red-300/90 bg-red-50/70" padding="sm">
          <p className="text-xs text-red-700">User scam đang chờ</p>
          <p className="text-xl font-semibold text-red-800">{pendingScam}</p>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card padding="lg" className="border-slate-200/90 bg-surface-1">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">Form chi hộ</h2>
            <p className="mt-1 text-xs text-slate-500">Chọn một yêu cầu bên phải để tự điền nhanh thông tin chuyển khoản.</p>
          </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
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
            </div>
            <div>
              <FieldLabel>Ghi chú</FieldLabel>
              <input value={remark} onChange={(e) => setRemark(e.target.value)} className={fieldInputClass} />
            </div>
            {selectedWithdrawal ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Đang liên kết lệnh rút #{String(selectedWithdrawal.id || selectedWithdrawal.mongoId || '—')} · User:{' '}
                {String(selectedWithdrawal.username || '—')} ({String(selectedWithdrawal.userId || '—')}) — chi hộ
                thành công sẽ tự duyệt.
              </p>
            ) : null}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && cooldownSeconds > 0 ? `Đang chờ ${cooldownSeconds}s...` : 'Gửi chi hộ'}
            </Button>
            {result ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  result.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                <p className="font-semibold">{result.title}</p>
                <p className="mt-1 text-xs">{result.detail}</p>
              </div>
            ) : null}
          </form>
        </Card>

        <Card padding="lg" variant="quiet" className="border-slate-200/90">
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Danh sách yêu cầu rút tiền</h2>
              <Button type="button" variant="secondary" onClick={() => void loadPendingWithdrawals()} disabled={loadingWithdrawals}>
                Làm mới
              </Button>
            </div>
            <p className="text-sm text-slate-500">Bấm chọn một yêu cầu để tự điền thông tin sang form chi hộ.</p>
            <div className="grid max-h-[540px] gap-3 overflow-auto pr-1 lg:grid-cols-2">
              {withdrawals.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 lg:col-span-2">
                  {loadingWithdrawals ? 'Đang tải danh sách...' : 'Không có yêu cầu rút đang chờ.'}
                </p>
              ) : (
                withdrawals.map((w, idx) => (
                  <button
                    key={String(w.id || `wd-${idx}`)}
                    type="button"
                    onClick={() => pickWithdrawal(w)}
                    className={`relative w-full rounded-2xl border bg-gradient-to-br px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      selectedKey === String(w.id || w.mongoId || '')
                        ? 'border-emerald-300 from-emerald-50 via-white to-sky-50 ring-2 ring-emerald-200/70'
                        : w.isScam
                          ? 'border-red-300 from-red-50 via-white to-red-50/40 shadow-[0_0_0_1px_rgba(239,68,68,0.18)]'
                        : w.isVerified
                          ? 'border-rose-200 from-rose-50/60 via-white to-rose-50/30 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]'
                          : 'border-sky-100 from-white via-sky-50/40 to-emerald-50/30 hover:border-accent/40'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0 h-full w-1.5 rounded-l-2xl ${
                        w.isScam ? 'bg-red-500/90' : w.isVerified ? 'bg-rose-400/80' : 'bg-sky-400/70'
                      }`}
                    />
                    {w.isScam ? (
                      <svg
                        aria-hidden
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <rect
                          x="1.2"
                          y="1.2"
                          width="97.6"
                          height="97.6"
                          rx="14"
                          ry="14"
                          fill="none"
                          stroke="rgb(239 68 68 / 0.5)"
                          strokeWidth="1.4"
                        />
                        <rect
                          x="1.2"
                          y="1.2"
                          width="97.6"
                          height="97.6"
                          rx="14"
                          ry="14"
                          fill="none"
                          stroke="rgb(220 38 38 / 0.98)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeDasharray="24 252"
                        >
                          <animate attributeName="stroke-dashoffset" from="0" to="-276" dur="1.6s" repeatCount="indefinite" />
                        </rect>
                      </svg>
                    ) : w.isVerified ? (
                      <svg
                        aria-hidden
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <rect
                          x="1.2"
                          y="1.2"
                          width="97.6"
                          height="97.6"
                          rx="14"
                          ry="14"
                          fill="none"
                          stroke="rgb(251 113 133 / 0.45)"
                          strokeWidth="1"
                        />
                        <rect
                          x="1.2"
                          y="1.2"
                          width="97.6"
                          height="97.6"
                          rx="14"
                          ry="14"
                          fill="none"
                          stroke="rgb(244 63 94 / 0.95)"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeDasharray="22 260"
                        >
                          <animate attributeName="stroke-dashoffset" from="0" to="-282" dur="2.2s" repeatCount="indefinite" />
                        </rect>
                      </svg>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">#{String(w.id || '—')}</p>
                      <div className="flex items-center gap-2">
                        {w.isScam ? (
                          <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                            SCAM
                          </span>
                        ) : null}
                        {w.isVerified ? (
                          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                            User verify
                          </span>
                        ) : null}
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          Chờ duyệt
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs font-medium text-sky-700">
                      {String(w.bankCode || mapBankCodeFromName(String(w.bankName || '')) || 'N/A')} · {String(w.bankName || 'N/A')}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {String(w.bankAccount || 'N/A')} · {String(w.bankHolder || 'N/A')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      User: {String(w.username || '—')} · ID: {String(w.userId || '—')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Mã GD: <span className="font-mono">{String(w.id || w.mongoId || '—')}</span>
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

      <Card padding="lg" className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">Lịch sử chi hộ gần nhất</h3>
            <p className="text-xs text-slate-500">Hiển thị mã lỗi, nội dung lỗi, trạng thái và thông tin tài khoản nhận.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={historyPageSize}
              onChange={(e) => {
                setHistoryPageSize(Number(e.target.value || 10));
                setHistoryPage(1);
              }}
              className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
            >
              {[10, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/trang
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => void loadHistory()} disabled={loadingHistory}>
              Làm mới
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              {loadingHistory ? 'Đang tải lịch sử...' : 'Chưa có lịch sử chi hộ.'}
            </p>
          ) : (
            (() => {
              const totalPages = Math.max(1, Math.ceil(history.length / historyPageSize));
              const safePage = Math.min(Math.max(1, historyPage), totalPages);
              const start = (safePage - 1) * historyPageSize;
              const rows = history.slice(start, start + historyPageSize);
              return (
                <>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Trang {safePage}/{totalPages} · {history.length} giao dịch
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                  {rows.map((it, idx) => {
              const code = String(it.errorCode || '');
              const isOk = code === '00';
              return (
                <div
                  key={`${String(it.ts || 0)}-${start + idx}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                      {Number(it.ts) > 0 ? new Date(Number(it.ts)).toLocaleString('vi-VN') : '—'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isOk ? 'Thành công' : 'Thất bại'}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">
                      Code: {code || 'N/A'}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                      {String(it.tranStatus || 'N/A')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {String(it.bankCode || 'N/A')} • {String(it.accountNumber || 'N/A')} ({String(it.accountName || 'N/A')})
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    User: {String(it.username || '—')} · ID: {String(it.userId || '—')}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Số tiền: <span className="font-semibold text-accent">{Number(it.amount || 0).toLocaleString('vi-VN')}đ</span>
                    {' · '}Mã GD: <span className="font-mono text-xs">{String(it.orderId || '—')}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ghi chú: {String(it.remark || '—')} {' · '}Phản hồi: {String(it.errorMessage || '—')}
                  </p>
                </div>
              );
            })}
                </>
              );
            })()
          )}
        </div>
      </Card>
    </div>
  );
}
