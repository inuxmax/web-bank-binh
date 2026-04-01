'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, useAppPopup } from '@/components/ui';

type Target = {
  id: string;
  webLogin: string;
  name: string;
  ctvCode: string;
  ctvStatus: string;
  customerFeePercent: number | null;
};

type Row = {
  id: string;
  name: string;
  webLogin: string;
  balance: number;
  isActive: boolean;
  isBanned: boolean;
  referredByUserId: string;
  isAssignedToTarget: boolean;
};

export default function ClientPage() {
  const popup = useAppPopup();
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Target | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/ctv-assign-taodeovao', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Không tải được dữ liệu'));
      setLoading(false);
      return;
    }
    setTarget((d.target || null) as Target | null);
    setItems(Array.isArray(d.items) ? (d.items as Row[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) =>
      [u.id, u.webLogin || '', u.name || '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  async function act(userId: string, action: 'assign' | 'unassign') {
    const ok = await popup.confirm(
      action === 'assign'
        ? `Gán user ${userId} vào CTV taodeovao?`
        : `Bỏ user ${userId} khỏi CTV taodeovao?`,
    );
    if (!ok) return;
    const res = await fetch('/api/admin/ctv-assign-taodeovao', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Thao tác thất bại'));
      return;
    }
    await load();
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Gán user cho CTV taodeovao"
        description="Trang riêng cho taodeovao: chọn user và gán trực tiếp vào CTV này."
      />

      {target ? (
        <div className="mb-4 rounded-[var(--radius-app-lg)] border border-sky-200/90 bg-sky-50/80 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-900">
            CTV đích: {target.name} ({target.webLogin || target.id})
          </p>
          <p className="mt-1 text-xs text-slate-600">
            User ID: {target.id} · Mã CTV: {target.ctvCode || '—'} · Trạng thái: {target.ctvStatus}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            % khách hiện tại: {target.customerFeePercent == null ? '—' : `${target.customerFeePercent}%`}
          </p>
        </div>
      ) : null}

      <div className="mb-3 w-full sm:w-[360px]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm user theo id/login/tên..."
          className="w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-inner-glow">
          <table className="w-full min-w-[980px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-surface-2/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Số dư</th>
                <th className="p-3">Active</th>
                <th className="p-3">Khóa</th>
                <th className="p-3">CTV hiện tại</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-slate-100 ${u.isAssignedToTarget ? 'bg-emerald-50/70' : 'hover:bg-slate-50/80'}`}
                >
                  <td className="p-3">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">
                      {u.id} · {u.webLogin || '—'}
                    </p>
                  </td>
                  <td className="p-3 tabular-nums">{Number(u.balance || 0).toLocaleString('vi-VN')} đ</td>
                  <td className="p-3">{u.isActive ? '✓' : '—'}</td>
                  <td className="p-3">{u.isBanned ? 'Khóa' : '—'}</td>
                  <td className="p-3 font-mono text-xs">
                    {u.referredByUserId || '—'}
                    {u.isAssignedToTarget ? (
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        taodeovao
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {u.isAssignedToTarget ? (
                      <button
                        type="button"
                        onClick={() => void act(u.id, 'unassign')}
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700"
                      >
                        Bỏ khỏi CTV
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void act(u.id, 'assign')}
                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                      >
                        Gán vào taodeovao
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-sm text-slate-500">
                    Không có user phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
