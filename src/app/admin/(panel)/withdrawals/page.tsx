'use client';

import { useEffect, useState } from 'react';
import { PageHeader, useAppPopup } from '@/components/ui';

type W = Record<string, unknown>;

function fmtTs(ts: unknown) {
  const n = Number(ts) || 0;
  if (!n) return '—';
  try {
    return new Date(n).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

export default function AdminWithdrawalsPage() {
  const popup = useAppPopup();
  const [status, setStatus] = useState<string>('pending');
  const [items, setItems] = useState<W[]>([]);

  async function load() {
    const url =
      status === '' ? '/api/admin/withdrawals' : `/api/admin/withdrawals?status=${encodeURIComponent(status)}`;
    const res = await fetch(url);
    const d = await res.json();
    setItems(d.items || []);
  }

  useEffect(() => {
    load();
  }, [status]);

  async function act(id: string, action: string, rejectNote?: string, mongoId?: string) {
    await fetch('/api/admin/withdrawals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, mongoId, action, rejectNote }),
    });
    load();
  }

  async function confirmAndAct(
    item: W,
    action: 'done' | 'reject_wrong' | 'reject' | 'reject_with_reason',
  ) {
    const id = String(item.id || '');
    const mongoId = String(item.mongoId || '');
    if (action === 'done') {
      const ok = await popup.confirm('Xác nhận đánh dấu lệnh này là ĐÃ RÚT?');
      if (!ok) return;
      await act(id, 'done', undefined, mongoId);
      return;
    }
    if (action === 'reject_wrong') {
      const ok = await popup.confirm('Xác nhận từ chối do SAI THÔNG TIN TÀI KHOẢN?');
      if (!ok) return;
      await act(id, 'reject_wrong', undefined, mongoId);
      return;
    }
    if (action === 'reject') {
      const ok = await popup.confirm('Xác nhận TỪ CHỐI lệnh rút này?');
      if (!ok) return;
      await act(id, 'reject', undefined, mongoId);
      return;
    }
    const ok = await popup.confirm('Xác nhận từ chối và nhập lý do?');
    if (!ok) return;
    const note = await popup.prompt({
      title: 'Từ chối + lý do',
      message: 'Nhập lý do từ chối (hoàn tiền)',
      placeholder: 'Ví dụ: Sai thông tin ngân hàng',
    });
    if (note && note.trim()) {
      await act(id, 'reject_with_reason', note.trim(), mongoId);
    }
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Rút tiền"
        description="Lọc và duyệt yêu cầu rút của người dùng."
      />
      <div className="flex flex-wrap gap-2">
        {['pending', 'done', 'reject', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-[var(--radius-app)] px-3.5 py-2 text-sm font-medium transition ${
              status === s
                ? 'bg-accent text-on-accent shadow-glow'
                : 'border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
            }`}
          >
            {s === '' ? 'Tất cả' : s}
          </button>
        ))}
      </div>
      <ul className="mt-8 space-y-3">
        {items.map((w, idx) => (
          <li
            key={String(w.id || w.mongoId || `row-${idx}`)}
            className={`relative rounded-[var(--radius-app-lg)] border bg-surface-1/95 p-5 text-sm text-slate-800 shadow-inner-glow ${
              w.isVerified === true
                ? 'border-rose-200 bg-rose-50/35 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]'
                : 'border-slate-200/90'
            }`}
          >
            {w.isVerified === true ? (
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
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-mono text-accent">{String(w.id || `WD-${String(w.mongoId || '').slice(-6)}`)}</span>
              <div className="flex items-center gap-2">
                {w.isVerified === true ? (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                    User verify
                  </span>
                ) : null}
                <span className="text-slate-500">{String(w.status)}</span>
              </div>
            </div>
            <p className="mt-2 text-slate-400">
              {String(w.bankName)} · {String(w.bankAccount)} · {String(w.bankHolder)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              User: {String(w.username || '—')} · ID: {String(w.userId || '—')}
            </p>
            <p className="mt-1">
              Số tiền: {Number(w.amount || 0).toLocaleString('vi-VN')}đ · Thực nhận:{' '}
              {Number(w.actualReceive || 0).toLocaleString('vi-VN')}đ
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Thời gian rút: {fmtTs(w.createdAt)} {Number(w.updatedAt || 0) ? `· Cập nhật: ${fmtTs(w.updatedAt)}` : ''}
            </p>
            {String(w.status) === 'pending' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void confirmAndAct(w, 'done')}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1 text-emerald-300"
                >
                  Đã rút
                </button>
                <button
                  type="button"
                  onClick={() => void confirmAndAct(w, 'reject_wrong')}
                  className="rounded-lg bg-rose-500/20 px-3 py-1 text-rose-300"
                >
                  Từ chối (sai TK)
                </button>
                <button
                  type="button"
                  onClick={() => void confirmAndAct(w, 'reject')}
                  className="rounded-lg bg-rose-500/20 px-3 py-1 text-rose-300"
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  onClick={() => void confirmAndAct(w, 'reject_with_reason')}
                  className="rounded-lg bg-white/10 px-3 py-1"
                >
                  Từ chối + lý do
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
