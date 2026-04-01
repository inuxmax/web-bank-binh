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
  userRatePercent: number | null;
  customerFeePercent: number | null;
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
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  useEffect(() => {
    setPage(1);
  }, [items.length]);

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

  async function setUserRate(r: Row) {
    const val = await popup.prompt({
      title: `Set % hoa hồng - ${r.id}`,
      message: 'Nhập từ 0 đến 100. Để trống để dùng mặc định global.',
      defaultValue: r.userRatePercent == null ? '' : String(r.userRatePercent),
      placeholder: 'Ví dụ: 1.5',
    });
    if (val === null) return;
    const raw = String(val || '').trim();
    let ratePercent: number | null = null;
    if (raw !== '') {
      const n = Number(raw.replace(/[^\d.]/g, ''));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        await popup.alert('% không hợp lệ (0-100)');
        return;
      }
      ratePercent = n;
    }
    const res = await fetch('/api/admin/ctv', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: 'set_rate', ratePercent }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Lưu % hoa hồng thất bại'));
      return;
    }
    await popup.alert('Đã cập nhật % hoa hồng cho user.');
    await load();
  }

  async function setCustomerFee(r: Row) {
    const val = await popup.prompt({
      title: `Set % khách theo CTV - ${r.id}`,
      message: 'Nhập từ 0 đến 100. Để trống để bỏ set riêng cho khách.',
      defaultValue: r.customerFeePercent == null ? '' : String(r.customerFeePercent),
      placeholder: 'Ví dụ: 15',
    });
    if (val === null) return;
    const raw = String(val || '').trim();
    let customerFeePercent: number | null = null;
    if (raw !== '') {
      const n = Number(raw.replace(/[^\d.]/g, ''));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        await popup.alert('% khách không hợp lệ (0-100)');
        return;
      }
      customerFeePercent = n;
    }
    const res = await fetch('/api/admin/ctv', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, action: 'set_customer_fee', customerFeePercent }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Lưu % khách thất bại'));
      return;
    }
    await popup.alert('Đã cập nhật % khách cho CTV và áp dụng cho user được giới thiệu.');
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
        <>
          {(() => {
            const total = items.length;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            const safePage = Math.min(Math.max(1, page), totalPages);
            const start = (safePage - 1) * pageSize;
            const rows = items.slice(start, start + pageSize);
            return (
              <>
                <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Trang {safePage}/{totalPages} · {total} user
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
                        <th className="p-3">% khách</th>
                        <th className="p-3">Đăng ký</th>
                        <th className="p-3">Duyệt</th>
                        <th className="p-3">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
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
                          <td className="p-3">
                            <div>{Number(r.ratePercent || 0)}%</div>
                            <div className="text-[11px] text-slate-500">
                              {r.userRatePercent == null ? 'Theo global' : 'Set riêng'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>{r.customerFeePercent == null ? '—' : `${Number(r.customerFeePercent)}%`}</div>
                            <div className="text-[11px] text-slate-500">Phí user được giới thiệu</div>
                          </td>
                          <td className="p-3 text-xs">{fmtTs(r.ctvAppliedAt)}</td>
                          <td className="p-3 text-xs">{fmtTs(r.ctvApprovedAt)}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void setUserRate(r)}
                                className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                              >
                                Set %
                              </button>
                              <button
                                type="button"
                                onClick={() => void setCustomerFee(r)}
                                className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700"
                              >
                                Set % khách
                              </button>
                              {r.ctvStatus !== 'approved' ? (
                                <button
                                  type="button"
                                  onClick={() => void act(r.id, 'approve')}
                                  className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                                >
                                  Duyệt
                                </button>
                              ) : null}
                              {r.ctvStatus !== 'rejected' ? (
                                <button
                                  type="button"
                                  onClick={() => void act(r.id, 'reject')}
                                  className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700"
                                >
                                  Từ chối
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

