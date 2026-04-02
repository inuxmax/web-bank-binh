'use client';

import { useEffect, useRef, useState } from 'react';
import { PageHeader, useAppPopup } from '@/components/ui';

type U = {
  id: string;
  username?: string;
  fullName?: string;
  webLogin?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  isBanned?: boolean;
  isVerified?: boolean;
  isScam?: boolean;
  balance: number;
  vaLimit: number | null;
  createdVA: number;
  registerIp?: string;
  registerAt?: number;
  lastLoginIp?: string;
  lastLoginAt?: number;
  ctvStatus?: string;
  ctvCode?: string;
  referredByCode?: string;
  referredByUserId?: string;
  telegramLinked?: boolean;
  telegramUsername?: string;
  feePercent: number | null;
  ipnFeeFlat: number | null;
  withdrawFeeFlat: number | null;
};

type HistoryPayload = {
  userId: string;
  createdVACount: number;
  vaRecords: {
    requestId: string;
    vaAccount: string;
    vaBank: string;
    name: string;
    status: string;
    remark: string;
    createdAt: number;
  }[];
  withdrawals: {
    id: string;
    amount: number;
    status: string;
    bankName: string;
    bankAccount: string;
    bankHolder: string;
    actualReceive: number;
    createdAt: number;
    updatedAt: number;
  }[];
  transactions: {
    ts: number;
    delta: number;
    balanceAfter: number;
    reason: string;
    ref: string;
    vaAccount?: string;
    vaBank?: string;
    transferContent?: string;
  }[];
};

function fmtTs(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

function reasonLabel(reason: string) {
  const r = String(reason || '').toLowerCase();
  if (r === 'admin_add') return 'Admin cộng tiền';
  if (r === 'withdraw_create') return 'Tạo lệnh rút';
  if (r === 'withdraw_done') return 'Rút thành công';
  if (r === 'withdraw_reject') return 'Từ chối rút';
  if (r === 'withdraw_reject_wrong') return 'Từ chối sai thông tin';
  if (r === 'withdraw_refund') return 'Hoàn tiền lệnh rút';
  if (r === 'withdraw_refund_reason') return 'Hoàn tiền có lý do';
  if (r.startsWith('withdraw_reject_note:')) return `Lý do từ chối: ${reason.slice('withdraw_reject_note:'.length)}`;
  if (r === 'va_paid') return 'Tiền về từ VA';
  return reason || '—';
}

function renderTxContent(t: HistoryPayload['transactions'][number]) {
  const reason = String(t.reason || '').toLowerCase();
  const isVaPaid = reason === 'ipn' || reason === 'va_paid';
  if (!isVaPaid) return reasonLabel(t.reason);
  const account = String(t.vaAccount || '').trim();
  const bank = String(t.vaBank || '').trim();
  const transferContent = String(t.transferContent || '').trim();
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-slate-800">Tiền vào từ VA</p>
      <p className="text-slate-600">
        VA: {account || '—'}{bank ? ` · NH: ${bank}` : ''}
      </p>
      <p className="break-all text-slate-600">Nội dung: {transferContent || '—'}</p>
      <p className="text-slate-700">Số tiền cộng: {Math.max(0, Number(t.delta) || 0).toLocaleString('vi-VN')} đ</p>
    </div>
  );
}

export default function AdminUsersPage() {
  const popup = useAppPopup();
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [historyUser, setHistoryUser] = useState<U | null>(null);
  const [historyData, setHistoryData] = useState<HistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [infoUser, setInfoUser] = useState<U | null>(null);
  const [feeUser, setFeeUser] = useState<U | null>(null);
  const [feePercentInput, setFeePercentInput] = useState('');
  const [ipnFeeInput, setIpnFeeInput] = useState('');
  const [withdrawFeeInput, setWithdrawFeeInput] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'active' | 'inactive' | 'banned'>('all');
  const [actionMenu, setActionMenu] = useState<{ userId: string; top: number; left: number } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    const res = await fetch('/api/admin/users');
    const d = await res.json();
    setUsers(d.users || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [quickFilter]);
  useEffect(() => {
    setActionMenu(null);
  }, [quickFilter, search, page, pageSize]);

  useEffect(() => {
    if (!actionMenu) return;
    const onPointerDown = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (actionMenuRef.current?.contains(target)) return;
      const trigger = target.closest(`[data-action-trigger="${actionMenu.userId}"]`);
      if (trigger) return;
      setActionMenu(null);
    };
    const onResizeOrScroll = () => setActionMenu(null);
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setActionMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
      document.removeEventListener('keydown', onEsc);
    };
  }, [actionMenu]);

  useEffect(() => {
    if (!historyUser) {
      setHistoryData(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryData(null);
    void fetch(`/api/admin/users/${encodeURIComponent(historyUser.id)}/history`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error && d.userId) setHistoryData(d as HistoryPayload);
        else setHistoryData(null);
      })
      .finally(() => setHistoryLoading(false));
  }, [historyUser]);

  useEffect(() => {
    setTxPage(1);
  }, [historyUser, historyData?.userId]);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(typeof d.error === 'string' ? d.error : 'Thao tác thất bại');
      return false;
    }
    load();
    return true;
  }

  async function activeAll() {
    const ok = await popup.confirm('Bật Active cho tất cả user (trừ user bị khóa)?');
    if (!ok) return;
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeAll: true }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      await popup.alert(typeof d.error === 'string' ? d.error : 'Active all thất bại');
      return;
    }
    await popup.alert(`Đã bật active cho ${Number(d.updated || 0)} user.`);
    await load();
  }

  function openFeeModal(u: U) {
    setFeeUser(u);
    setFeePercentInput(u.feePercent == null ? '' : String(u.feePercent));
    setIpnFeeInput(u.ipnFeeFlat == null ? '' : String(u.ipnFeeFlat));
    setWithdrawFeeInput(u.withdrawFeeFlat == null ? '' : String(u.withdrawFeeFlat));
  }

  async function saveFeeForUser() {
    if (!feeUser) return;
    const parseNullableNumber = (v: string, min = 0, max?: number): number | null => {
      const t = v.trim();
      if (!t) return null;
      const n = Number(t.replace(/[^\d.]/g, ''));
      if (!Number.isFinite(n)) return null;
      if (n < min) return null;
      if (max !== undefined && n > max) return null;
      return n;
    };
    const feePercent = parseNullableNumber(feePercentInput, 0, 100);
    const ipnFeeFlat = parseNullableNumber(ipnFeeInput, 0);
    const withdrawFeeFlat = parseNullableNumber(withdrawFeeInput, 0);
    if (feePercentInput.trim() && feePercent === null) {
      await popup.alert('% phí không hợp lệ (0-100)');
      return;
    }
    if (ipnFeeInput.trim() && ipnFeeFlat === null) {
      await popup.alert('Phí chuyển không hợp lệ');
      return;
    }
    if (withdrawFeeInput.trim() && withdrawFeeFlat === null) {
      await popup.alert('Phí rút không hợp lệ');
      return;
    }
    setFeeSaving(true);
    await patch(feeUser.id, { feePercent, ipnFeeFlat, withdrawFeeFlat });
    setFeeSaving(false);
    setFeeUser(null);
  }

  async function promptAddBalance(u: U) {
    const amtStr = await popup.prompt({
      title: 'Cộng tiền',
      message: 'Số tiền cộng (VNĐ, chỉ nhập số)',
      defaultValue: '100000',
    });
    if (amtStr === null) return;
    const n = Number(String(amtStr).replace(/\D/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      await popup.alert('Số tiền không hợp lệ');
      return;
    }
    if (n > 1_000_000_000) {
      await popup.alert('Vượt giới hạn 1.000.000.000 / lần');
      return;
    }
    const note = await popup.prompt({
      title: 'Ghi chú',
      message: 'Ghi chú hiển thị trong lịch sử số dư (tùy chọn)',
      defaultValue: 'Admin cộng tiền',
    });
    if (note === null) return;
    void patch(u.id, {
      addBalance: Math.floor(n),
      balanceNote: note.trim() || undefined,
    });
  }

  async function promptSubtractBalance(u: U) {
    const amtStr = await popup.prompt({
      title: 'Trừ tiền',
      message: 'Số tiền trừ (VNĐ, chỉ nhập số)',
      defaultValue: '100000',
    });
    if (amtStr === null) return;
    const n = Number(String(amtStr).replace(/\D/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      await popup.alert('Số tiền không hợp lệ');
      return;
    }
    if (n > 1_000_000_000) {
      await popup.alert('Vượt giới hạn 1.000.000.000 / lần');
      return;
    }
    const currentBalance = Number(u.balance || 0);
    if (n > currentBalance) {
      await popup.alert('Số dư user hiện tại không đủ để trừ.');
      return;
    }
    const note = await popup.prompt({
      title: 'Ghi chú',
      message: 'Ghi chú hiển thị trong lịch sử số dư (tùy chọn)',
      defaultValue: 'Admin trừ tiền',
    });
    if (note === null) return;
    void patch(u.id, {
      subtractBalance: Math.floor(n),
      balanceNote: note.trim() || undefined,
    });
  }

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="Admin"
          title="Người dùng"
          description="Kích hoạt, khóa tài khoản, cộng tiền nội bộ, phí và giới hạn VA."
        />
        <p className="text-sm text-slate-500">Đang tải…</p>
      </div>
    );
  }

  const keyword = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (quickFilter === 'active' && !u.isActive) return false;
    if (quickFilter === 'inactive' && u.isActive) return false;
    if (quickFilter === 'banned' && !u.isBanned) return false;
    if (!keyword) return true;
    const fields = [
      u.id,
      u.webLogin || '',
      u.username || '',
      u.telegramUsername || '',
      u.registerIp || '',
      u.lastLoginIp || '',
    ]
      .join(' ')
      .toLowerCase();
    return fields.includes(keyword);
  });

  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedUsers = filteredUsers.slice(pageStart, pageStart + pageSize);

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Người dùng"
        description="Kích hoạt tài khoản, khóa (ban) user, cộng tiền nội bộ, phí và giới hạn VA. Xem lịch sử giao dịch, tạo VA và rút tiền."
      />

      {historyUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng"
            onClick={() => setHistoryUser(null)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/90 bg-surface-2/80 px-4 py-3">
              <div>
                <h2 id="history-title" className="font-display text-lg font-semibold text-slate-900">
                  Lịch sử user
                </h2>
                <p className="mt-0.5 font-mono text-xs text-accent">{historyUser.id}</p>
                <p className="text-xs text-slate-500">
                  {historyUser.webLogin || historyUser.username || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryUser(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="max-h-[calc(90vh-8rem)] overflow-y-auto p-4 text-sm text-slate-700">
              {historyLoading ? (
                <p className="text-slate-500">Đang tải lịch sử…</p>
              ) : historyData ? (
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Số VA đã tạo (đếm hệ thống)
                    </h3>
                    <p className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-2 font-mono text-base font-semibold text-slate-900">
                      {historyData.createdVACount.toLocaleString('vi-VN')}
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Giao dịch số dư
                    </h3>
                    {historyData.transactions.length === 0 ? (
                      <p className="text-slate-500">Chưa có giao dịch số dư.</p>
                    ) : (
                      (() => {
                        const txPageSize = 10;
                        const txTotal = historyData.transactions.length;
                        const txTotalPages = Math.max(1, Math.ceil(txTotal / txPageSize));
                        const txSafePage = Math.min(Math.max(1, txPage), txTotalPages);
                        const txStart = (txSafePage - 1) * txPageSize;
                        const txRows = historyData.transactions.slice(txStart, txStart + txPageSize);
                        return (
                          <>
                            <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                              <table className="w-full min-w-[760px] text-left text-xs">
                                <thead className="bg-surface-2/80 text-[10px] uppercase tracking-wide text-slate-500">
                                  <tr>
                                    <th className="p-2">Thời gian</th>
                                    <th className="p-2">Biến động</th>
                                    <th className="p-2">Số dư sau</th>
                                    <th className="p-2">Nội dung</th>
                                    <th className="p-2">Ref</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {txRows.map((t, idx) => (
                                    <tr key={`${t.ts}-${t.ref}-${idx}`} className="border-t border-slate-100">
                                      <td className="p-2 whitespace-nowrap text-slate-600">{fmtTs(t.ts)}</td>
                                      <td
                                        className={`p-2 whitespace-nowrap font-semibold tabular-nums ${
                                          t.delta > 0 ? 'text-emerald-700' : t.delta < 0 ? 'text-rose-700' : 'text-slate-600'
                                        }`}
                                      >
                                        {t.delta > 0 ? '+' : ''}
                                        {t.delta.toLocaleString('vi-VN')} đ
                                      </td>
                                      <td className="p-2 whitespace-nowrap tabular-nums">{t.balanceAfter.toLocaleString('vi-VN')} đ</td>
                                      <td className="p-2">{renderTxContent(t)}</td>
                                      <td className="p-2 font-mono text-[11px]">{t.ref || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                              <span>
                                Trang {txSafePage}/{txTotalPages} · {txTotal} giao dịch
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                                  disabled={txSafePage <= 1}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                                >
                                  Trước
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                                  disabled={txSafePage >= txTotalPages}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                                >
                                  Sau
                                </button>
                              </div>
                            </div>
                          </>
                        );
                      })()
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tạo VA (chi tiết)
                    </h3>
                    {historyData.vaRecords.length === 0 ? (
                      <p className="text-slate-500">Chưa có VA.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                        <table className="w-full min-w-[640px] text-left text-xs">
                          <thead className="bg-surface-2/80 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="p-2">Thời gian</th>
                              <th className="p-2">Số VA</th>
                              <th className="p-2">Ngân hàng</th>
                              <th className="p-2">Tên</th>
                              <th className="p-2">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyData.vaRecords.map((r) => (
                              <tr key={r.requestId || r.vaAccount} className="border-t border-slate-100">
                                <td className="p-2 whitespace-nowrap text-slate-600">{fmtTs(r.createdAt)}</td>
                                <td className="p-2 font-mono text-[11px]">{r.vaAccount || '—'}</td>
                                <td className="p-2">{r.vaBank || '—'}</td>
                                <td className="p-2">{r.name || '—'}</td>
                                <td className="p-2">{r.status || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Rút tiền
                    </h3>
                    {historyData.withdrawals.length === 0 ? (
                      <p className="text-slate-500">Chưa có yêu cầu rút.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                        <table className="w-full min-w-[640px] text-left text-xs">
                          <thead className="bg-surface-2/80 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="p-2">Thời gian</th>
                              <th className="p-2">Số tiền</th>
                              <th className="p-2">Trạng thái</th>
                              <th className="p-2">Ngân hàng</th>
                              <th className="p-2">Tài khoản</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyData.withdrawals.map((w) => (
                              <tr key={w.id} className="border-t border-slate-100">
                                <td className="p-2 whitespace-nowrap text-slate-600">{fmtTs(w.createdAt)}</td>
                                <td className="p-2 tabular-nums">{w.amount.toLocaleString('vi-VN')} đ</td>
                                <td className="p-2">{w.status}</td>
                                <td className="p-2">{w.bankName || '—'}</td>
                                <td className="p-2 font-mono text-[11px]">{w.bankAccount || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <p className="text-rose-600">Không tải được lịch sử.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {infoUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng"
            onClick={() => setInfoUser(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="info-title" className="font-display text-lg font-semibold text-slate-900">
                  Thông tin user
                </h2>
                <p className="mt-0.5 font-mono text-xs text-accent">{infoUser.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setInfoUser(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-slate-500">Họ tên:</span> <span className="font-medium text-slate-900">{infoUser.fullName || '—'}</span></p>
              <p><span className="text-slate-500">Username:</span> <span className="font-medium text-slate-900">{infoUser.username || '—'}</span></p>
              <p><span className="text-slate-500">Login:</span> <span className="font-medium text-slate-900">{infoUser.webLogin || '—'}</span></p>
              <p><span className="text-slate-500">SĐT:</span> <span className="font-medium text-slate-900">{infoUser.phone || '—'}</span></p>
              <p className="sm:col-span-2"><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900">{infoUser.email || '—'}</span></p>
              <p><span className="text-slate-500">Telegram:</span> <span className="font-medium text-slate-900">{infoUser.telegramLinked ? 'Đã liên kết' : 'Chưa liên kết'}</span></p>
              <p><span className="text-slate-500">@username Telegram:</span> <span className="font-mono text-slate-900">{infoUser.telegramUsername ? `@${String(infoUser.telegramUsername).replace(/^@+/, '')}` : '—'}</span></p>
              <p><span className="text-slate-500">CTV:</span> <span className="font-medium text-slate-900">{infoUser.ctvStatus || 'none'}</span></p>
              <p><span className="text-slate-500">Mã CTV:</span> <span className="font-mono text-slate-900">{infoUser.ctvCode || '—'}</span></p>
              <p><span className="text-slate-500">Giới thiệu bởi:</span> <span className="font-medium text-slate-900">{infoUser.referredByUserId || '—'}</span></p>
              <p><span className="text-slate-500">Mã ref dùng:</span> <span className="font-mono text-slate-900">{infoUser.referredByCode || '—'}</span></p>
              <p className="sm:col-span-2"><span className="text-slate-500">IP đăng ký:</span> <span className="font-mono text-slate-900">{infoUser.registerIp || '—'}</span> · <span className="text-slate-600">{fmtTs(Number(infoUser.registerAt || 0))}</span></p>
              <p className="sm:col-span-2"><span className="text-slate-500">IP đăng nhập gần nhất:</span> <span className="font-mono text-slate-900">{infoUser.lastLoginIp || '—'}</span> · <span className="text-slate-600">{fmtTs(Number(infoUser.lastLoginAt || 0))}</span></p>
            </div>
          </div>
        </div>
      ) : null}

      {feeUser ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fee-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng"
            onClick={() => setFeeUser(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4 shadow-xl">
            <h2 id="fee-title" className="font-display text-lg font-semibold text-slate-900">
              Set phí user
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {feeUser.id} · {feeUser.webLogin || feeUser.username || '—'}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">% phí</span>
                <input
                  value={feePercentInput}
                  onChange={(e) => setFeePercentInput(e.target.value)}
                  placeholder="Để trống = theo cấu hình global"
                  className="mt-1 w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Phí chuyển (IPN flat)</span>
                <input
                  value={ipnFeeInput}
                  onChange={(e) => setIpnFeeInput(e.target.value)}
                  placeholder="Để trống = theo cấu hình global"
                  className="mt-1 w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Phí rút (flat)</span>
                <input
                  value={withdrawFeeInput}
                  onChange={(e) => setWithdrawFeeInput(e.target.value)}
                  placeholder="Để trống = theo cấu hình global"
                  className="mt-1 w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFeeUser(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void saveFeeForUser()}
                disabled={feeSaving}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent disabled:opacity-50"
              >
                {feeSaving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Chưa kích hoạt' },
            { key: 'banned', label: 'Bị khóa' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setQuickFilter(opt.key as typeof quickFilter)}
              className={`rounded-[var(--radius-app)] px-2.5 py-1 text-xs font-medium ${
                quickFilter === opt.key
                  ? 'bg-accent text-on-accent'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void activeAll()}
            className="rounded-[var(--radius-app)] border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            Active all
          </button>
        </div>
        <div className="w-full sm:w-[320px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm user: id, login, username, @telegram, IP..."
            className="w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
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

      <div className="mt-2 overflow-x-auto rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-inner-glow">
        <table className="w-full min-w-[1500px] text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 bg-surface-2/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-[190px] p-3">ID</th>
              <th className="w-[150px] p-3">Login</th>
              <th className="w-[70px] p-3 whitespace-nowrap">Active</th>
              <th className="w-[90px] p-3 whitespace-nowrap">Khóa</th>
              <th className="w-[120px] p-3 whitespace-nowrap">Số dư</th>
              <th className="w-[90px] p-3 whitespace-nowrap">VA</th>
              <th className="w-[90px] p-3 whitespace-nowrap">% phí</th>
              <th className="w-[110px] p-3 whitespace-nowrap">Phí rút</th>
              <th className="w-[120px] p-3 whitespace-nowrap">Phí chuyển</th>
              <th className="w-[250px] p-3 whitespace-nowrap">IP đăng ký</th>
              <th className="w-[250px] p-3 whitespace-nowrap">IP đăng nhập gần nhất</th>
              <th className="w-[360px] p-3 whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-slate-100 ${
                  u.isScam
                    ? 'bg-rose-100/90 hover:bg-rose-200/80'
                    : u.isVerified
                      ? 'bg-sky-100/90 hover:bg-sky-200/80'
                      : 'hover:bg-slate-50/80'
                }`}
              >
                <td className="p-3 font-mono text-xs text-accent">
                  <div className="flex max-w-[180px] items-center gap-1.5 truncate" title={u.id}>
                    <span className="truncate">{u.id}</span>
                    {u.isScam ? (
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white"
                        title="Đánh dấu scam"
                      >
                        !
                      </span>
                    ) : null}
                    {u.isVerified ? (
                      <span
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white"
                        title="Đã verify"
                      >
                        ✓
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="p-3">
                  <div className="max-w-[140px] truncate" title={u.webLogin || u.username || '—'}>
                    {u.webLogin || u.username || '—'}
                  </div>
                </td>
                <td className="p-3 whitespace-nowrap">{u.isActive ? '✓' : '—'}</td>
                <td className="p-3 whitespace-nowrap">
                  {u.isBanned ? (
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                      Khóa
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums">{(u.balance || 0).toLocaleString('vi-VN')}</td>
                <td className="p-3 whitespace-nowrap">
                  {u.createdVA} / {u.vaLimit ?? '∞'}
                </td>
                <td className="p-3 whitespace-nowrap">{u.feePercent == null ? '—' : `${u.feePercent}%`}</td>
                <td className="p-3 whitespace-nowrap">{u.withdrawFeeFlat == null ? '—' : Number(u.withdrawFeeFlat).toLocaleString('vi-VN')}</td>
                <td className="p-3 whitespace-nowrap">{u.ipnFeeFlat == null ? '—' : Number(u.ipnFeeFlat).toLocaleString('vi-VN')}</td>
                <td className="p-3 text-xs">
                  <div className="max-w-[240px] break-all font-mono leading-4">{u.registerIp || '—'}</div>
                  <div className="mt-1 whitespace-nowrap text-slate-500">{fmtTs(Number(u.registerAt || 0))}</div>
                </td>
                <td className="p-3 text-xs">
                  <div className="max-w-[240px] break-all font-mono leading-4">{u.lastLoginIp || '—'}</div>
                  <div className="mt-1 whitespace-nowrap text-slate-500">{fmtTs(Number(u.lastLoginAt || 0))}</div>
                </td>
                <td className="relative p-3">
                  <button
                    type="button"
                    data-action-trigger={u.id}
                    onClick={(e) => {
                      if (actionMenu?.userId === u.id) {
                        setActionMenu(null);
                        return;
                      }
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      const menuWidth = 232;
                      const menuHeight = 252;
                      const gap = 8;
                      const left = Math.max(
                        8,
                        Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth),
                      );
                      const placeUp = rect.bottom + gap + menuHeight > window.innerHeight;
                      const top = placeUp
                        ? Math.max(8, rect.top - menuHeight - gap)
                        : Math.max(8, rect.bottom + gap);
                      setActionMenu({ userId: u.id, top, left });
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Thao tác
                  </button>
                  {actionMenu?.userId === u.id ? (
                    <div
                      ref={actionMenuRef}
                      style={{ top: actionMenu.top, left: actionMenu.left }}
                      className="fixed z-[90] w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                    >
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            void patch(u.id, { isActive: !u.isActive });
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {u.isActive ? 'Tắt' : 'Bật'}
                        </button>
                        <button
                          type="button"
                          disabled={u.id === 'admin'}
                          title={u.id === 'admin' ? 'Không áp dụng cho tài khoản admin hệ thống' : undefined}
                          onClick={async () => {
                            if (u.id === 'admin') return;
                            const next = !u.isBanned;
                            if (!next) {
                              const ok = await popup.confirm(`Mở khóa user ${u.id}?`);
                              if (!ok) return;
                            } else {
                              const ok = await popup.confirm(`Khóa (ban) user ${u.id}? Họ không đăng nhập được.`);
                              if (!ok) return;
                            }
                            setActionMenu(null);
                            void patch(u.id, { isBanned: next });
                          }}
                          className="rounded-lg border border-rose-200/80 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {u.isBanned ? 'Mở khóa' : 'Khóa'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            void promptAddBalance(u);
                          }}
                          className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-medium text-accent hover:bg-accent/15"
                        >
                          Cộng tiền
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            void promptSubtractBalance(u);
                          }}
                          className="rounded-lg border border-amber-300/80 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Trừ tiền
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            void patch(u.id, { isVerified: !u.isVerified });
                          }}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                            u.isVerified
                              ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {u.isVerified ? 'Bỏ verify' : 'Verify'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            void patch(u.id, { isScam: !u.isScam });
                          }}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                            u.isScam
                              ? 'border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {u.isScam ? 'Bỏ scam' : 'Đánh dấu scam'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            openFeeModal(u);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Set phí
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            setInfoUser(u);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Thông tin
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionMenu(null);
                            setHistoryUser(u);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Lịch sử
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const v = await popup.prompt({
                              title: 'Giới hạn VA',
                              message: 'Giới hạn VA (số, để trống = không giới hạn)',
                              defaultValue: String(u.vaLimit ?? ''),
                            });
                            if (v === null) return;
                            setActionMenu(null);
                            void patch(u.id, { vaLimit: v === '' ? null : Number(v) });
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Limit
                        </button>
                      </div>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
