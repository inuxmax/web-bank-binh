'use client';

import { useMemo, useState } from 'react';

type HistoryViewItem = {
  ts: number;
  delta: number;
  balanceAfter: number;
  title: string;
  reason: string;
  ref: string;
  lines: string[];
};

function fmtTs(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

function fmtVnd(n: number) {
  return `${(Number(n) || 0).toLocaleString('vi-VN')} đ`;
}

export function HistoryList({ items }: { items: HistoryViewItem[] }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, pageSize, safePage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Hiển thị</span>
          {[10, 20, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPageSize(n);
                setPage(1);
              }}
              className={`rounded-[var(--radius-app)] px-2.5 py-1 text-xs font-medium ${
                pageSize === n
                  ? 'bg-accent text-on-accent'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-slate-500">/ trang</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Trang {safePage}/{totalPages} · {items.length} dòng
          </span>
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

      <ul className="space-y-2">
        {paged.map((it, i) => (
          <li
            key={`${it.ts}-${it.ref}-${i}`}
            className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/90 px-5 py-4 text-sm text-slate-800 shadow-inner-glow"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-500">{fmtTs(it.ts)}</span>
              <span className={`font-semibold tabular-nums ${it.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {it.delta >= 0 ? '+' : ''}
                {fmtVnd(it.delta)}
              </span>
              <span className="text-slate-600 tabular-nums">Sau: {fmtVnd(it.balanceAfter)}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{it.title}</p>
            <div className="mt-1 space-y-0.5 text-xs text-slate-600">
              {it.lines.map((line, idx) => {
                const isBankLine = line.startsWith('Ngân hàng:');
                const isReceiveLine = line.startsWith('Thực nhận:');
                if (isBankLine || isReceiveLine) {
                  return (
                    <p
                      key={`${it.ref}-line-${idx}`}
                      className={
                        isReceiveLine
                          ? 'rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700'
                          : 'rounded bg-sky-50 px-2 py-1 font-semibold text-sky-700'
                      }
                    >
                      {line}
                    </p>
                  );
                }
                return <p key={`${it.ref}-line-${idx}`}>{line}</p>;
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

