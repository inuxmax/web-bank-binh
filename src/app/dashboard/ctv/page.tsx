'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui';

type CtvMe = {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  isApproved: boolean;
  shareCode: string;
  shareLink: string;
  referralUsers: number;
  referredUsers: {
    id: string;
    username: string;
    fullName: string;
    isActive: boolean;
    registerAt: number;
    paidVaCount: number;
  }[];
  paidCount: number;
  commissionTotal: number;
  commissionCount: number;
  commissionHistory: {
    ts: number;
    amount: number;
    ref: string;
    requestId: string;
    vaAccount: string;
    bankName: string;
    sourceUserId: string;
    sourceUsername: string;
  }[];
  ratePercent: number;
};

function fmtTs(ts: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

export default function DashboardCtvPage() {
  const [data, setData] = useState<CtvMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [referredPageSize, setReferredPageSize] = useState(10);
  const [referredPage, setReferredPage] = useState(1);

  async function load() {
    setLoading(true);
    setErr('');
    const res = await fetch('/api/ctv/me', { cache: 'no-store' });
    const d = await res.json().catch(() => null);
    if (!res.ok) {
      setErr((d && d.error) || 'Không tải được dữ liệu CTV');
      setData(null);
      setLoading(false);
      return;
    }
    setData(d as CtvMe);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setReferredPage(1);
  }, [referredPageSize, data?.shareCode, data?.referralUsers]);

  async function applyCtv() {
    setErr('');
    setMsg('');
    setApplying(true);
    const res = await fetch('/api/ctv/apply', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    const d = await res.json().catch(() => ({}));
    setApplying(false);
    if (!res.ok) {
      setErr(String(d.error || 'Đăng ký CTV thất bại'));
      return;
    }
    setMsg('Đã gửi đăng ký CTV. Vui lòng chờ admin duyệt.');
    setData((prev) => (prev ? { ...prev, status: 'pending' } : prev));
    await load();
  }

  async function copyText(value: string, label: string) {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setErr('');
      setMsg(`Đã copy ${label}.`);
    } catch {
      setMsg('');
      setErr(`Không copy được ${label} trên trình duyệt này.`);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tài khoản"
        title="Cộng tác viên"
        description="Đăng ký CTV, lấy link/mã chia sẻ, theo dõi hoa hồng đã cộng vào số dư."
      />
      {msg ? (
        <div className="mb-3 rounded-[var(--radius-app)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="mb-3 rounded-[var(--radius-app)] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      {loading || !data ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4">
            <p className="text-sm text-slate-500">Trạng thái CTV</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {data.status === 'approved'
                ? 'Đã duyệt'
                : data.status === 'pending'
                  ? 'Chờ admin duyệt'
                  : data.status === 'rejected'
                    ? 'Đã từ chối'
                    : 'Chưa đăng ký'}
            </p>
            {data.status !== 'approved' ? (
              <button
                type="button"
                onClick={() => void applyCtv()}
                disabled={applying || data.status === 'pending'}
                className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent disabled:opacity-60"
              >
                {data.status === 'pending'
                  ? 'Đang chờ duyệt'
                  : applying
                    ? 'Đang gửi…'
                    : 'Đăng ký làm CTV'}
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4">
              <p className="text-sm text-slate-500">Mã chia sẻ</p>
              {data.isApproved ? (
                <>
                  <div className="mt-3 rounded-[var(--radius-app)] border border-accent/25 bg-gradient-to-br from-accent/10 via-white to-emerald-50/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-accent">Mã CTV của bạn</p>
                      <button
                        type="button"
                        onClick={() => void copyText(data.shareCode || '', 'mã chia sẻ')}
                        className="rounded-md border border-accent/30 bg-white px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/5"
                      >
                        Copy mã
                      </button>
                    </div>
                    <p className="mt-2 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-base font-bold tracking-wide text-emerald-300">
                      {data.shareCode || '—'}
                    </p>
                  </div>

                  <div className="mt-3 rounded-[var(--radius-app)] border border-slate-200 bg-slate-50/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Link chia sẻ</p>
                      <button
                        type="button"
                        onClick={() => void copyText(data.shareLink || '', 'link chia sẻ')}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Copy link
                      </button>
                    </div>
                    <p className="mt-2 break-all rounded-md bg-white px-2 py-1.5 font-mono text-xs text-accent">
                      {data.shareLink || '—'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p>Chưa được duyệt CTV nên chưa hiển thị mã chia sẻ. Vui lòng liên hệ admin để duyệt CTV.</p>
                  <a
                    href="https://t.me/lieunhuyenbet"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Liên hệ admin Telegram: @lieunhuyenbet
                  </a>
                  <a
                    href="https://t.me/lieunhuyen02"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Liên hệ tele phụ do tele chính bị khóa cấm chat: @lieunhuyen02
                  </a>
                  <p className="mt-2 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    ⚠️ Tính năng CTV đang code dở vẫn chưa xong, vui lòng chờ 1-2 ngày.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4">
              <p className="text-sm font-medium text-slate-700">Thống kê hoa hồng</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-700">Tổng hoa hồng</p>
                  <p className="mt-1 text-base font-semibold text-emerald-800">
                    {Number(data.commissionTotal || 0).toLocaleString('vi-VN')} đ
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Số lượt cộng</p>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {Number(data.commissionCount || 0).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">User giới thiệu</p>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {Number(data.referralUsers || 0).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Lượt nhận tiền VA</p>
                  <p className="mt-1 text-base font-semibold text-slate-800">
                    {Number(data.paidCount || 0).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Danh sách user đã giới thiệu</p>
                <p className="mt-1 text-xs text-slate-500">Theo dõi user đăng ký qua mã CTV và số lượt VA đã thanh toán.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Hiển thị</span>
                {[10, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReferredPageSize(n)}
                    className={`rounded-[var(--radius-app)] px-2.5 py-1 text-xs font-medium ${
                      referredPageSize === n
                        ? 'bg-accent text-on-accent'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="text-xs text-slate-500">/ trang</span>
              </div>
            </div>
            {!data.referredUsers || data.referredUsers.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Chưa có user nào đăng ký qua mã giới thiệu của bạn.</p>
            ) : (
              (() => {
                const total = data.referredUsers.length;
                const totalPages = Math.max(1, Math.ceil(total / referredPageSize));
                const safePage = Math.min(Math.max(1, referredPage), totalPages);
                const start = (safePage - 1) * referredPageSize;
                const rows = data.referredUsers.slice(start, start + referredPageSize);
                return (
                  <>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/90 shadow-inner-glow">
                      <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="bg-surface-2/80 text-[10px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="p-2">User</th>
                            <th className="p-2">Họ tên</th>
                            <th className="p-2">ID</th>
                            <th className="p-2">Trạng thái</th>
                            <th className="p-2">Đăng ký</th>
                            <th className="p-2">Lượt VA đã thanh toán</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((u) => (
                            <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                              <td className="p-2 font-medium text-slate-800">{u.username || '—'}</td>
                              <td className="p-2">{u.fullName || '—'}</td>
                              <td className="p-2 font-mono text-[11px] text-slate-600">{u.id}</td>
                              <td className="p-2">
                                {u.isActive ? (
                                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                    Đã duyệt
                                  </span>
                                ) : (
                                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                    Chờ duyệt
                                  </span>
                                )}
                              </td>
                              <td className="p-2 whitespace-nowrap text-slate-600">{fmtTs(u.registerAt)}</td>
                              <td className="p-2 font-semibold text-slate-800">
                                {Number(u.paidVaCount || 0).toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Trang {safePage}/{totalPages} · {total} user
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReferredPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-700 disabled:opacity-50"
                        >
                          Trước
                        </button>
                        <button
                          type="button"
                          onClick={() => setReferredPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
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
          </div>

          <div className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4">
            <p className="text-sm font-medium text-slate-700">Lịch sử nhận tiền từ user giới thiệu</p>
            {!data.commissionHistory || data.commissionHistory.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Chưa có lượt nhận hoa hồng nào.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200/90">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="bg-surface-2/80 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-2">Thời gian</th>
                      <th className="p-2">User nhận tiền</th>
                      <th className="p-2">VA</th>
                      <th className="p-2">Ngân hàng</th>
                      <th className="p-2">Hoa hồng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commissionHistory.map((r, idx) => (
                      <tr key={`${r.ref}-${idx}`} className="border-t border-slate-100">
                        <td className="p-2 whitespace-nowrap text-slate-600">{fmtTs(r.ts)}</td>
                        <td className="p-2">
                          <p className="font-medium text-slate-800">{r.sourceUsername || '—'}</p>
                          <p className="text-[11px] text-slate-500">{r.sourceUserId || '—'}</p>
                        </td>
                        <td className="p-2 font-mono text-[11px]">{r.vaAccount || '—'}</td>
                        <td className="p-2">{r.bankName || '—'}</td>
                        <td className="p-2 font-semibold text-emerald-700">
                          +{Number(r.amount || 0).toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

