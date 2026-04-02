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
  totalTransactionAmount: number;
  registerAt: number;
  isActive: boolean;
  isBanned: boolean;
  referredByUserId: string;
  isAssignedToTarget: boolean;
};

export default function ClientPage() {
  const popup = useAppPopup();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [targetInput, setTargetInput] = useState('taodeovao');
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [modalPageSize, setModalPageSize] = useState(10);
  const [modalPage, setModalPage] = useState(1);
  const [modalSearch, setModalSearch] = useState('');

  async function load(targetUserId?: string) {
    setLoading(true);
    const q = new URLSearchParams();
    const targetKey = String(targetUserId || targetInput || '').trim();
    if (targetKey) q.set('targetUserId', targetKey);
    const res = await fetch(`/api/admin/ctv-assign-taodeovao?${q.toString()}`, { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Không tải được dữ liệu'));
      setLoading(false);
      return;
    }
    const t = (d.target || null) as Target | null;
    setTarget(t);
    if (t?.webLogin) setTargetInput(t.webLogin);
    setItems(Array.isArray(d.items) ? (d.items as Row[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    void load(targetInput);
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

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);
  useEffect(() => {
    setModalPage(1);
  }, [modalPageSize, showUsersModal, items.length]);
  useEffect(() => {
    setModalPage(1);
  }, [modalSearch]);
  const modalFiltered = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) =>
      [u.id, u.webLogin || '', u.name || '', u.referredByUserId || '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [items, modalSearch]);


  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);
  const selectedSet = new Set(selectedIds);
  const allPageChecked = paged.length > 0 && paged.every((u) => selectedSet.has(u.id));
  const allFilteredChecked = filtered.length > 0 && filtered.every((u) => selectedSet.has(u.id));

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return [...set];
    });
  }

  function toggleAllPage(checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      for (const u of paged) {
        if (checked) set.add(u.id);
        else set.delete(u.id);
      }
      return [...set];
    });
  }

  function toggleAllFiltered(checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      for (const u of filtered) {
        if (checked) set.add(u.id);
        else set.delete(u.id);
      }
      return [...set];
    });
  }

  async function act(userId: string, action: 'assign' | 'unassign') {
    const targetLabel = target?.webLogin || target?.id || targetInput || 'user đích';
    const ok = await popup.confirm(
      action === 'assign'
        ? `Gán user ${userId} vào CTV ${targetLabel}?`
        : `Bỏ user ${userId} khỏi CTV ${targetLabel}?`,
    );
    if (!ok) return;
    setActing(true);
    const res = await fetch('/api/admin/ctv-assign-taodeovao', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, targetUserId: target?.id || targetInput }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Thao tác thất bại'));
      setActing(false);
      return;
    }
    await load(target?.id || targetInput);
    setActing(false);
  }

  async function actMany(action: 'assign_many' | 'unassign_many', ids: string[], label: string) {
    if (!ids.length) {
      await popup.alert('Chưa chọn user.');
      return;
    }
    const ok = await popup.confirm(`${label} (${ids.length} user)?`);
    if (!ok) return;
    setActing(true);
    const res = await fetch('/api/admin/ctv-assign-taodeovao', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userIds: ids, targetUserId: target?.id || targetInput }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Thao tác thất bại'));
      setActing(false);
      return;
    }
    await popup.alert(`Đã cập nhật ${Number(d.updated || 0)} user.`);
    await load(target?.id || targetInput);
    setSelectedIds([]);
    setActing(false);
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Gán user cho CTV chỉ định"
        description="Nhập user đích (id hoặc webLogin), sau đó gán user vào CTV đó."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          placeholder="User đích: taodeovao, web_democtv123, ..."
          className="w-full max-w-[420px] rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
        <button
          type="button"
          onClick={() => void load(targetInput)}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          Chọn user đích
        </button>
      </div>

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
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowUsersModal(true)}
          className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Xem user
        </button>
      </div>

      {showUsersModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-users-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng"
            onClick={() => setShowUsersModal(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/90 bg-surface-2/80 px-4 py-3">
              <div>
                <h2 id="all-users-title" className="font-display text-lg font-semibold text-slate-900">
                  Toàn bộ danh sách user
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Hiển thị ID, tổng tiền giao dịch, CTV hiện tại và ngày tạo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto p-4">
              {(() => {
                const totalRows = modalFiltered.length;
                const totalModalPages = Math.max(1, Math.ceil(totalRows / modalPageSize));
                const safeModalPage = Math.min(Math.max(1, modalPage), totalModalPages);
                const startModal = (safeModalPage - 1) * modalPageSize;
                const modalRows = modalFiltered.slice(startModal, startModal + modalPageSize);
                return (
                  <>
                    <div className="mb-3 w-full sm:w-[360px]">
                      <input
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Tìm trong popup: id / user / login / CTV..."
                        className="w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      />
                    </div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Hiển thị</span>
                        {[10, 50, 100].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setModalPageSize(n)}
                            className={`rounded px-2 py-1 ${
                              modalPageSize === n
                                ? 'bg-accent text-on-accent'
                                : 'border border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                        <span className="text-slate-500">/ trang</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>
                          Trang {safeModalPage}/{totalModalPages} · {totalRows} user
                        </span>
                        <button
                          type="button"
                          onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                          disabled={safeModalPage <= 1}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                        >
                          Trước
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalPage((p) => Math.min(totalModalPages, p + 1))}
                          disabled={safeModalPage >= totalModalPages}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-[var(--radius-app)] border border-slate-200/90">
                      <table className="w-full min-w-[820px] text-left text-xs text-slate-700">
                        <thead className="bg-surface-2/80 text-[10px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="p-2">ID</th>
                            <th className="p-2">User</th>
                            <th className="p-2">Tổng tiền giao dịch</th>
                            <th className="p-2">CTV hiện tại</th>
                            <th className="p-2">Ngày tạo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalRows.map((u) => (
                            <tr key={u.id} className="border-t border-slate-100">
                              <td className="p-2 font-mono text-[11px]">{u.id}</td>
                              <td className="p-2">
                                <p className="font-medium text-slate-900">{u.name || '—'}</p>
                                <p className="text-slate-500">{u.webLogin || '—'}</p>
                              </td>
                              <td className="p-2 font-semibold text-emerald-700">
                                {Number(u.totalTransactionAmount || 0).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="p-2 font-mono text-[11px]">
                                {u.referredByUserId || '—'}
                                {u.isAssignedToTarget ? (
                                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    {target?.webLogin || 'target'}
                                  </span>
                                ) : null}
                              </td>
                              <td className="p-2 whitespace-nowrap text-slate-600">
                                {u.registerAt ? new Date(u.registerAt).toLocaleString('vi-VN') : '—'}
                              </td>
                            </tr>
                          ))}
                          {modalRows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-sm text-slate-500">
                                Không có user.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Hiển thị</span>
            {[10, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPageSize(n)}
                className={`rounded px-2 py-1 ${
                  pageSize === n
                    ? 'bg-accent text-on-accent'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-slate-500">/ trang</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span>
              Trang {safePage}/{totalPages} · {total} user
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
      ) : null}

      {!loading ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
            <input type="checkbox" checked={allPageChecked} onChange={(e) => toggleAllPage(e.target.checked)} />
            Chọn tất cả trang này
          </label>
          <label className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1">
            <input
              type="checkbox"
              checked={allFilteredChecked}
              onChange={(e) => toggleAllFiltered(e.target.checked)}
            />
            Chọn tất cả theo lọc
          </label>
          <button
            type="button"
            disabled={acting}
            onClick={() => void actMany('assign_many', selectedIds, 'Gán CTV cho user đã chọn')}
            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 font-medium text-emerald-700 disabled:opacity-50"
          >
            Gán user đã chọn
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => void actMany('unassign_many', selectedIds, 'Xóa khỏi CTV user đã chọn')}
            className="rounded border border-rose-300 bg-rose-50 px-2 py-1 font-medium text-rose-700 disabled:opacity-50"
          >
            Xóa khỏi CTV user đã chọn
          </button>
          <button
            type="button"
            disabled={acting || filtered.length === 0}
            onClick={() =>
              void actMany(
                'assign_many',
                filtered.map((u) => u.id),
                'Gán all user trong danh sách lọc',
              )
            }
            className="rounded border border-emerald-300 bg-white px-2 py-1 font-medium text-emerald-700 disabled:opacity-50"
          >
            Gán all (theo lọc)
          </button>
          <button
            type="button"
            disabled={acting || filtered.length === 0}
            onClick={() =>
              void actMany(
                'unassign_many',
                filtered.map((u) => u.id),
                'Xóa all khỏi CTV trong danh sách lọc',
              )
            }
            className="rounded border border-rose-300 bg-white px-2 py-1 font-medium text-rose-700 disabled:opacity-50"
          >
            Xóa all khỏi CTV (theo lọc)
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-inner-glow">
          <table className="w-full min-w-[980px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-surface-2/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3 w-[48px]">Chọn</th>
                <th className="p-3">User</th>
                <th className="p-3">Số dư</th>
                <th className="p-3">Active</th>
                <th className="p-3">Khóa</th>
                <th className="p-3">CTV hiện tại</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-slate-100 ${u.isAssignedToTarget ? 'bg-emerald-50/70' : 'hover:bg-slate-50/80'}`}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(u.id)}
                      onChange={(e) => toggleOne(u.id, e.target.checked)}
                    />
                  </td>
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
                        {target?.webLogin || 'target'}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => void act(u.id, 'assign')}
                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                      >
                        Gán
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => void act(u.id, 'unassign')}
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
                      >
                        Xóa khỏi CTV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-sm text-slate-500">
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
