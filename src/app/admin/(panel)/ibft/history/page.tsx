'use client';

import { useEffect, useState } from 'react';
import { formatDateTimeVNClient } from '@/lib/va-display';
import { Card, PageHeader } from '@/components/ui';

export default function IbftHistoryPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/api/admin/ibft-history?limit=500')
      .then((r) => r.json())
      .then((d) => {
        const rows = Array.isArray(d.items) ? d.items : [];
        setItems(
          rows.filter(
            (it: Record<string, unknown>) =>
              Boolean(String(it.userId || '').trim()) && Boolean(String(it.username || '').trim()),
          ),
        );
        setPage(1);
      });
  }, []);

  return (
    <div>
      <PageHeader eyebrow="IBFT" title="Lịch sử chi hộ" description="Các lệnh chuyển gần đây và phản hồi API." />
      <div className="mb-3 flex items-center justify-between gap-2">
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value || 10));
            setPage(1);
          }}
          className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
        >
          {[10, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/trang
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 space-y-3">
        {(() => {
          const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
          const safePage = Math.min(Math.max(1, page), totalPages);
          const start = (safePage - 1) * pageSize;
          const rows = items.slice(start, start + pageSize);
          return (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Trang {safePage}/{totalPages} · {items.length} giao dịch
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
              {rows.map((it, i) => {
          const code = String(it.errorCode || '');
          const isOk = code === '00';
          return (
            <Card key={start + i} padding="md" className="border border-slate-200/90 bg-white">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                  {formatDateTimeVNClient(Number(it.ts) || 0)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {isOk ? 'Thành công' : 'Thất bại'}
                </span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">
                  Mã lỗi: {code || 'N/A'}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                  Trạng thái: {String(it.tranStatus || 'N/A')}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {String(it.bankCode || 'N/A')} • {String(it.accountNumber || 'N/A')} ({String(it.accountName || 'N/A')})
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Số tiền:{' '}
                <span className="font-semibold text-accent">{Number(it.amount || 0).toLocaleString('vi-VN')}đ</span>
                {' · '}Mã GD: <span className="font-mono text-xs">{String(it.orderId || '—')}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                User: {String(it.username || '—')} · ID: {String(it.userId || '—')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Ghi chú: {String(it.remark || '—')} {' · '}Phản hồi API: {String(it.errorMessage || '—')}
              </p>
            </Card>
          );
        })}
            </>
          );
        })()}
      </div>
    </div>
  );
}
