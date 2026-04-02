'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button, PageHeader, useAppPopup } from '@/components/ui';

type VaRow = {
  vaAccount: string;
  vaName: string;
  bankCode: string;
  userId: string;
  username: string;
  remark: string;
  status: string;
  createdAt: number;
};

function pickString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const val = raw[key];
    if (val === undefined || val === null) continue;
    const s = String(val).trim();
    if (s) return s;
  }
  return '';
}

function pickNumber(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function normalizeVaRow(raw: Record<string, unknown>): VaRow {
  return {
    vaAccount: pickString(raw, ['vaAccount', 'account', 'accountNo']),
    vaName: pickString(raw, ['vaName', 'name', 'accountName']),
    bankCode: pickString(raw, ['bankCode', 'vaBank', 'bankName']),
    userId: pickString(raw, ['userId', 'ownerId', 'uid']),
    username: pickString(raw, ['username', 'webLogin', 'userName', 'ownerUsername']),
    remark: pickString(raw, ['remark', 'transferContent']),
    status: pickString(raw, ['status', 'vaStatus']) || '—',
    createdAt: pickNumber(raw, ['createdAt', 'createTime', 'timeCreated']),
  };
}

function fmtTs(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

export default function AdminVaManagerPage() {
  const popup = useAppPopup();
  const [rows, setRows] = useState<VaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/va-manager?size=500', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      await popup.alert(String(d.error || 'Không tải được danh sách VA từ API'));
      return;
    }
    const items: Record<string, unknown>[] = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
    const nextRows = items
      .map((x: Record<string, unknown>) => normalizeVaRow((x || {}) as Record<string, unknown>))
      .filter((x: VaRow) => x.vaAccount);
    setRows(nextRows);
    setSelectedMap({});
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter((r) =>
      `${r.vaAccount} ${r.vaName} ${r.userId} ${r.username} ${r.bankCode} ${r.remark} ${r.status}`
        .toLowerCase()
        .includes(key),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const selectedAccounts = Object.keys(selectedMap).filter((k) => selectedMap[k]);
  const pageAllChecked = pageRows.length > 0 && pageRows.every((x) => Boolean(selectedMap[x.vaAccount]));

  function toggleOne(vaAccount: string) {
    setSelectedMap((prev) => ({ ...prev, [vaAccount]: !prev[vaAccount] }));
  }

  function toggleAllOnPage() {
    setSelectedMap((prev) => {
      const next = { ...prev };
      const nextVal = !pageAllChecked;
      for (const r of pageRows) next[r.vaAccount] = nextVal;
      return next;
    });
  }

  async function copyVaAccount(vaAccount: string) {
    try {
      await navigator.clipboard.writeText(String(vaAccount || '').trim());
      await popup.alert(`Đã copy STK VA: ${vaAccount}`);
    } catch {
      await popup.alert('Không copy được STK VA trên trình duyệt này.');
    }
  }

  function exportExcel() {
    if (!filtered.length) {
      void popup.alert('Không có dữ liệu VA để xuất.');
      return;
    }
    const rowsForSheet = filtered.map((r, idx) => ({
      STT: idx + 1,
      'STK VA': r.vaAccount,
      'Tên TK': r.vaName || '',
      User: r.username || r.userId || '',
      'Ngân hàng': r.bankCode || '',
      'Nội dung': r.remark || '',
      'Trạng thái': r.status || '',
      'Tạo lúc': fmtTs(r.createdAt),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsForSheet);
    XLSX.utils.book_append_sheet(wb, ws, 'VA');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(wb, `va-manager-${ts}.xlsx`);
  }

  async function deleteSelected() {
    const targets = selectedAccounts;
    if (!targets.length) {
      await popup.alert('Vui lòng chọn ít nhất 1 VA để xóa.');
      return;
    }
    const ok = await popup.confirm(`Xóa ${targets.length} VA đã chọn?`);
    if (!ok) return;
    setDeleting(true);
    const targetItems = rows
      .filter((r) => targets.includes(r.vaAccount))
      .map((r) => ({ vaAccount: r.vaAccount, bankCode: r.bankCode || '' }));
    const res = await fetch('/api/admin/va-manager', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vaAccounts: targets, vaItems: targetItems }),
    });
    const d = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      await popup.alert(String(d.error || 'Xóa VA thất bại'));
      return;
    }
    await popup.alert(`Đã xử lý xóa VA: thành công ${Number(d.success || 0)} / lỗi ${Number(d.failed || 0)}.`);
    await load();
  }

  async function deleteOne(vaAccount: string) {
    const ok = await popup.confirm(`Xóa VA ${vaAccount}?`);
    if (!ok) return;
    setDeleting(true);
    const row = rows.find((x) => x.vaAccount === vaAccount);
    const res = await fetch('/api/admin/va-manager', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vaAccounts: [vaAccount],
        vaItems: [{ vaAccount, bankCode: row?.bankCode || '' }],
      }),
    });
    const d = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      await popup.alert(String(d.error || 'Xóa VA thất bại'));
      return;
    }
    const success = Number(d.success || 0);
    if (success > 0) {
      setRows((prev) => prev.filter((x) => x.vaAccount !== vaAccount));
      setSelectedMap((prev) => {
        const next = { ...prev };
        delete next[vaAccount];
        return next;
      });
    } else {
      await popup.alert(`Xóa thất bại: ${String(d.results?.[0]?.errorMessage || d.results?.[0]?.errorCode || 'N/A')}`);
    }
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Quản lý VA"
        description="Lấy toàn bộ danh sách VA từ API HPay và thực hiện xóa (revoke) theo chọn lựa."
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
              placeholder="Tìm VA, tên, user, ngân hàng..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading || deleting}>
              Làm mới
            </Button>
            <Button type="button" variant="secondary" onClick={exportExcel} disabled={loading || deleting || !filtered.length}>
              Xuất Excel
            </Button>
            <Button type="button" onClick={() => void deleteSelected()} disabled={deleting || selectedAccounts.length === 0}>
              {deleting ? 'Đang xóa...' : `Xóa đã chọn (${selectedAccounts.length})`}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải danh sách VA từ API...</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-inner-glow">
          <table className="w-full min-w-[1220px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-surface-2/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3 w-[44px]">
                  <input type="checkbox" checked={pageAllChecked} onChange={toggleAllOnPage} />
                </th>
                <th className="p-3">STK VA</th>
                <th className="p-3">Tên TK</th>
                <th className="p-3">User</th>
                <th className="p-3">Ngân hàng</th>
                <th className="p-3">Nội dung</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Tạo lúc</th>
                <th className="p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    Không có dữ liệu VA.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.vaAccount} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMap[r.vaAccount])}
                        onChange={() => toggleOne(r.vaAccount)}
                      />
                    </td>
                    <td className="p-3 font-mono text-xs text-accent">{r.vaAccount}</td>
                    <td className="p-3">{r.vaName || '—'}</td>
                    <td className="p-3">
                      <span className="font-medium">{r.username || '—'}</span>
                      <span className="ml-1 text-xs text-slate-500">{r.userId ? `(${r.userId})` : ''}</span>
                    </td>
                    <td className="p-3">{r.bankCode || '—'}</td>
                    <td className="p-3">{r.remark || '—'}</td>
                    <td className="p-3">{r.status || '—'}</td>
                    <td className="p-3 text-xs text-slate-500">{fmtTs(r.createdAt)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyVaAccount(r.vaAccount)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          Copy STK
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteOne(r.vaAccount)}
                          disabled={deleting}
                          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 disabled:opacity-50"
                        >
                          Xóa VA
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Trang {safePage}/{totalPages} · {filtered.length} VA
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
