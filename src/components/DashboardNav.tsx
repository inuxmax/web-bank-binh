'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const userLinks = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/dashboard/va/new', label: 'Tạo VA' },
  { href: '/dashboard/va', label: 'VA của tôi' },
  { href: '/dashboard/withdraw', label: 'Rút tiền' },
  { href: '/dashboard/ctv', label: 'Cộng tác viên' },
  { href: '/dashboard/history', label: 'Lịch sử số dư' },
];

const adminLinks: { href: string; label: string; perm: string }[] = [
  { href: '/admin', label: 'Bảng quản trị', perm: 'admin_home' },
  { href: '/admin/users', label: 'Người dùng', perm: 'users' },
  { href: '/admin/withdrawals', label: 'Duyệt rút tiền', perm: 'withdrawals' },
  { href: '/admin/ctv', label: 'Quản lý CTV', perm: 'ctv' },
  { href: '/admin/va-bulk', label: 'Tạo VA hàng loạt', perm: 'va_bulk' },
  { href: '/admin/announcements', label: 'Thông báo', perm: 'announcements' },
  { href: '/admin/balance', label: 'Số dư Sinpay', perm: 'balance' },
  { href: '/admin/ibft', label: 'Chi hộ', perm: 'ibft' },
  { href: '/admin/ibft/history', label: 'Lịch sử chi hộ', perm: 'ibft_history' },
  { href: '/admin/settings', label: 'Cấu hình', perm: 'settings' },
  { href: '/admin/permissions', label: 'Phân quyền', perm: 'permissions' },
];

const ONLY_TAODEOVAO_LINKS: { href: string; label: string; perm: string }[] = [
  { href: '/admin/ctv-assign-taodeovao', label: 'Gán user cho CTV', perm: 'ctv' },
];

function isTaodeovaoAdmin(userId?: string) {
  const uid = String(userId || '').trim().toLowerCase();
  return uid === 'web_taodeovao' || uid === 'taodeovao';
}

/**
 * Một mục menu active duy nhất.
 * - Ưu tiên khớp đúng pathname (sau khi bỏ slash cuối) → tránh /dashboard/va và /dashboard/va/new cùng sáng.
 * - Không có exact: chọn prefix dài nhất (path.startsWith(h + '/')).
 */
function getActiveHref(pathname: string, hrefs: string[]): string {
  const path = (pathname.replace(/\/$/, '') || '/') as string;
  if (hrefs.includes(path)) return path;

  let best = '';
  for (const h of hrefs) {
    if (path.startsWith(`${h}/`) && h.length > best.length) best = h;
  }
  return best;
}

function navLinkClass(active: boolean) {
  return cn(
    'flex items-center gap-2.5 rounded-[var(--radius-app)] px-3 py-2.5 text-[13px] font-medium transition duration-200',
    active
      ? 'bg-accent/12 text-slate-900 shadow-inner-glow ring-1 ring-accent/15'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  );
}

export function DashboardNav({
  isAdmin,
  adminPermissions,
  currentUserId,
  profile,
  onLogout,
}: {
  isAdmin: boolean;
  adminPermissions?: string[];
  currentUserId?: string;
  profile?: {
    name?: string;
    roleLabel?: string;
    balance?: number;
    createdVA?: number;
  };
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);
  const allowedAdminLinks = isAdmin
    ? [
        ...adminLinks.filter((l) => (adminPermissions || []).includes(l.perm)),
        ...(isTaodeovaoAdmin(currentUserId) ? ONLY_TAODEOVAO_LINKS : []),
      ]
    : [];
  const allowedUserLinks = [
    ...userLinks,
    ...(isTaodeovaoAdmin(currentUserId) && !isAdmin
      ? [{ href: '/admin/ctv-assign-taodeovao', label: 'Gán user cho CTV' }]
      : []),
  ];
  const hrefs = isAdmin
    ? [...allowedUserLinks, ...allowedAdminLinks].map((l) => l.href)
    : allowedUserLinks.map((l) => l.href);
  const activeHref = getActiveHref(pathname, hrefs);

  const renderLinks = (items: { href: string; label: string }[]) =>
    items.map(({ href, label }) => {
      const active = href === activeHref;
      return (
        <Link key={href} href={href} className={navLinkClass(active)}>
          <span
            className={cn(
              'hidden h-1.5 w-1.5 shrink-0 rounded-full md:block',
              active ? 'bg-accent shadow-[0_0_8px_rgba(13,155,136,0.45)]' : 'bg-slate-300',
            )}
            aria-hidden
          />
          {label}
        </Link>
      );
    });

  useEffect(() => {
    let mounted = true;
    async function syncOnline() {
      try {
        const res = await fetch('/api/online/status', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (res.ok) {
          setOnlineUsers(Number(data.onlineUsers || 0));
        }
      } catch {
        // ignore
      }
    }
    void syncOnline();
    const t = setInterval(() => {
      void syncOnline();
    }, 30000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  return (
    <aside className="sticky top-0 z-20 flex w-full flex-col border-b border-slate-200/90 bg-surface-1/95 p-4 shadow-sm backdrop-blur-xl md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r md:p-4 md:py-6">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-1 md:px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
          H
        </span>
        <span className="font-display text-base font-semibold tracking-tight text-slate-900">
          Sinpay <span className="text-accent">Console</span>
        </span>
      </Link>

      <nav className="flex max-h-[40vh] flex-row flex-wrap gap-x-2 gap-y-2 overflow-y-auto md:max-h-none md:flex-col md:flex-nowrap md:gap-x-0 md:gap-y-2 md:overflow-visible md:py-1">
        <p className="mb-0.5 w-full basis-full px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Tài khoản
        </p>
        {renderLinks(allowedUserLinks)}

        {isAdmin ? (
          <>
            <div
              className="my-2 w-full basis-full border-t border-slate-200/90 md:my-3"
              role="separator"
              aria-hidden
            />
            <p className="mb-0.5 w-full basis-full px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Quản trị
            </p>
            {renderLinks(allowedAdminLinks)}
          </>
        ) : null}
      </nav>

      <div className="mt-6 hidden flex-1 md:block" />

      <div className="mb-3 hidden rounded-[var(--radius-app)] border border-emerald-200/90 bg-emerald-50/70 p-3 md:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Online Web</p>
        <p className="mt-1 text-lg font-semibold text-emerald-800">
          {onlineUsers == null ? '...' : onlineUsers.toLocaleString('vi-VN')} người
        </p>
        <p className="text-[11px] text-emerald-700/80">Tự cập nhật mỗi 30 giây</p>
      </div>

      <div className="hidden rounded-[var(--radius-app)] border border-slate-200/90 bg-surface-2/90 p-3 md:block">
        <p className="truncate text-sm font-semibold text-slate-900">{profile?.name || '—'}</p>
        <p className="mt-0.5 text-xs text-slate-500">{profile?.roleLabel || (isAdmin ? 'Admin' : 'Người dùng')}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
          <div className="rounded bg-white/80 px-2 py-1">
            <span className="block text-slate-400">Số dư</span>
            <span className="font-medium text-slate-900">
              {Number(profile?.balance || 0).toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="rounded bg-white/80 px-2 py-1">
            <span className="block text-slate-400">VA đã tạo</span>
            <span className="font-medium text-slate-900">{Number(profile?.createdVA || 0)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-3 hidden w-full rounded-[var(--radius-app)] px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 md:block"
      >
        Đăng xuất
      </button>
    </aside>
  );
}
