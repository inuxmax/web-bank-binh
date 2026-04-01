'use client';

import { useEffect, useState } from 'react';
import { formatDateTimeVNClient } from '@/lib/va-display';
import { Card, PageHeader } from '@/components/ui';

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
      <div className="mt-2 space-y-3">
        {items.map((it, i) => {
          const code = String(it.errorCode || '');
          const isOk = code === '00';
          return (
            <Card key={i} padding="md" className="border border-slate-200/90 bg-white">
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
                {' · '}Order: <span className="font-mono text-xs">{String(it.orderId || '—')}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Ghi chú: {String(it.remark || '—')} {' · '}Phản hồi API: {String(it.errorMessage || '—')}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
