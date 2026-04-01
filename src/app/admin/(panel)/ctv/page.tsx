'use client';

import { useEffect, useState } from 'react';
import { PageHeader, useAppPopup } from '@/components/ui';

type Row = {
  id: string;
  name: string;
  webLogin: string;
  ctvStatus: 'none' | 'pending' | 'approved' | 'rejected';
  ctvCode: string;
  referralCount: number;
  commissionTotal: number;
  commissionCount: number;
  ratePercent: number;
  ctvAppliedAt: number;
  ctvApprovedAt: number;
};

function fmtTs(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

export default function AdminCtvPage() {
  const popup = useAppPopup();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/ctv');
    const d = await res.json().catch(() => ({ items: [] }));
    setItems(Array.isArray(d.items) ? d.items : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: 'approve' | 'reject') {
    const ok = await popup.confirm(
      action === 'approve' ? `Duyệt CTV ${id}?` : `Từ chối CTV ${id}?`,
    );
    if (!ok) return;
    await fetch('/api/admin/ctv', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    await load();
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Quản lý CTV"
        description="Duyệt CTV, theo dõi thu nhập và thống kê giới thiệu."
      />

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-inner-glow">
          <table className="w-full min-w-[980px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-surface-2/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Mã CTV</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Đã giới thiệu</th>
                <th className="p-3">Thu nhập</th>
                <th className="p-3">Số lượt</th>
                <th className="p-3">Tỷ lệ</th>
                <th className="p-3">Đăng ký</th>
                <th className="p-3">Duyệt</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="p-3">
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.id}</p>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.ctvCode || '—'}</td>
                  <td className="p-3">{r.ctvStatus}</td>
                  <td className="p-3">{Number(r.referralCount || 0).toLocaleString('vi-VN')}</td>
                  <td className="p-3">{Number(r.commissionTotal || 0).toLocaleString('vi-VN')} đ</td>
                  <td className="p-3">{Number(r.commissionCount || 0).toLocaleString('vi-VN')}</td>
                  <td className="p-3">{Number(r.ratePercent || 0)}%</td>
                  <td className="p-3 text-xs">{fmtTs(r.ctvAppliedAt)}</td>
                  <td className="p-3 text-xs">{fmtTs(r.ctvApprovedAt)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void act(r.id, 'approve')}
                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        onClick={() => void act(r.id, 'reject')}
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700"
                      >
                        Từ chối
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

