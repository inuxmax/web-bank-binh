'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, useAppPopup } from '@/components/ui';

type PermissionDef = { id: string; label: string };
type Row = {
  id: string;
  name: string;
  webLogin: string;
  isActive: boolean;
  adminPermissions: string[];
};

const PRESETS: { id: string; label: string; permissions: string[] }[] = [
  {
    id: 'support',
    label: 'Hỗ trợ',
    permissions: ['admin_home', 'users', 'ctv', 'announcements'],
  },
  {
    id: 'withdraw',
    label: 'Duyệt rút',
    permissions: ['admin_home', 'withdrawals', 'ctv'],
  },
  {
    id: 'finance',
    label: 'Tài chính',
    permissions: ['admin_home', 'va_bulk', 'balance', 'ibft', 'ibft_history', 'va_manage'],
  },
  {
    id: 'manager',
    label: 'Quản lý',
    permissions: [
      'admin_home',
      'users',
      'withdrawals',
      'ctv',
      'announcements',
      'va_bulk',
      'balance',
      'ibft',
      'ibft_history',
      'settings',
      'shop_bank',
      'va_manage',
    ],
  },
];

export default function AdminPermissionsPage() {
  const popup = useAppPopup();
  const [items, setItems] = useState<Row[]>([]);
  const [defs, setDefs] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState('');
  const [q, setQ] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/permissions', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    setItems(Array.isArray(d.items) ? d.items : []);
    setDefs(Array.isArray(d.permissions) ? d.permissions : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  async function saveUser(userId: string, perms: string[]) {
    setSavingUserId(userId);
    const res = await fetch('/api/admin/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adminPermissions: perms }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(String(d.error || 'Lưu quyền thất bại'));
    } else {
      setItems((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, adminPermissions: d.adminPermissions || perms } : u)),
      );
    }
    setSavingUserId('');
  }

  function togglePerm(userId: string, perm: string) {
    setItems((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u;
        const has = u.adminPermissions.includes(perm);
        const next = has ? u.adminPermissions.filter((p) => p !== perm) : [...u.adminPermissions, perm];
        void saveUser(userId, next);
        return { ...u, adminPermissions: next };
      }),
    );
  }

  function applyPreset(userId: string, presetPerms: string[]) {
    setItems((prev) => prev.map((u) => (u.id === userId ? { ...u, adminPermissions: presetPerms } : u)));
    void saveUser(userId, presetPerms);
  }

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return items;
    return items.filter((u) => `${u.id} ${u.name} ${u.webLogin}`.toLowerCase().includes(key));
  }, [items, q]);

  const totalUsers = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Phân quyền"
        description="Cấp quyền truy cập các module admin cho user. Có quyền nào mới thấy và dùng được mục đó."
      />

      <div className="mb-4 rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-3 shadow-inner-glow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Hiển thị</span>
            {[10, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPageSize(n)}
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
          <div className="w-full sm:w-[320px]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Tìm user..."
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Trang {safePage}/{totalPages} · {totalUsers} user
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
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="space-y-3">
          {paged.map((u) => (
            <div
              key={u.id}
              className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-4 shadow-inner-glow transition hover:shadow-md"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{u.name || u.id}</p>
                  <p className="text-xs text-slate-500">
                    {u.id} · {u.webLogin || '—'} · {u.isActive ? 'Đã duyệt' : 'Chưa duyệt'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(u.id, p.permissions)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => applyPreset(u.id, [])}
                    className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700"
                  >
                    Gỡ admin
                  </button>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                {defs.map((p) => {
                  const checked = u.adminPermissions.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePerm(u.id, p.id)}
                        disabled={savingUserId === u.id}
                      />
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

