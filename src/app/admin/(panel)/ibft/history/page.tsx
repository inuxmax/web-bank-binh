'use client';

import { useEffect, useState } from 'react';
import { formatDateTimeVNClient } from '@/lib/va-display';
import { PageHeader } from '@/components/ui';

export default function IbftHistoryPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch('/api/admin/ibft-history?limit=80')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="IBFT" title="Lịch sử chi hộ" description="Các lệnh chuyển gần đây và phản hồi API." />
      <ul className="mt-2 space-y-3">
        {items.map((it, i) => (
          <li
            key={i}
            className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 px-5 py-4 text-sm text-slate-700 shadow-inner-glow"
          >
            <span className="text-slate-500">{formatDateTimeVNClient(Number(it.ts) || 0)}</span>
            <span className="mx-2">·</span>
            {String(it.bankCode)} → {String(it.accountNumber)} ({String(it.accountName)}){' '}
            <span className="text-accent">{Number(it.amount).toLocaleString('vi-VN')}đ</span>
            <div className="mt-1 text-xs text-slate-600">
              {String(it.errorCode)} {String(it.errorMessage)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
