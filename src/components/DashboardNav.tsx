'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const userLinks = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard/va/new', label: 'Tạo Tên+STK' },
  { href: '/dashboard/va', label: 'Tên+STK Đã Tạo' },
  { href: '/dashboard/withdraw', label: 'Rút tiền' },
  { href: '/dashboard/sim-rent', label: 'Thuê Sim' },
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
  { href: '/admin/shop-bank', label: 'Shop bank', perm: 'shop_bank' },
  { href: '/admin/va-manager', label: 'Quản lý VA', perm: 'va_manage' },
];

const ONLY_TAODEOVAO_LINKS: { href: string; label: string; perm: string }[] = [
  { href: '/admin/ctv-assign-taodeovao', label: 'Setting CTV', perm: 'ctv' },
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
  const [mobileOpen, setMobileOpen] = useState(false);
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
      ? [{ href: '/admin/ctv-assign-taodeovao', label: 'Setting CTV' }]
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <aside className="sticky top-0 z-20 flex w-full flex-col border-b border-slate-200/90 bg-surface-1/95 p-4 shadow-sm backdrop-blur-xl md:fixed md:inset-y-0 md:left-0 md:z-30 md:h-screen md:w-60 md:shrink-0 md:overflow-hidden md:border-b-0 md:border-r md:p-4 md:py-6">
      <div className="mb-3 flex items-center justify-between gap-2 md:mb-6">
        <Link href="/dashboard" className="flex items-center gap-2 px-1 md:px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
            H
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-slate-900">
            Sinpay <span className="text-accent">Console</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 md:hidden"
        >
          {mobileOpen ? 'Đóng menu' : 'Mở menu'}
        </button>
      </div>

      <div className={`${mobileOpen ? 'block' : 'hidden'} md:flex md:min-h-0 md:flex-1 md:flex-col`}>
        <nav className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto border-t border-slate-100 pt-3 md:min-h-0 md:max-h-none md:flex md:flex-1 md:flex-col md:flex-nowrap md:gap-y-2 md:overflow-y-auto md:border-t-0 md:pt-1 md:pr-1">
          <p className="mb-0.5 col-span-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:basis-auto">
            Tài khoản
          </p>
          {renderLinks(allowedUserLinks)}

          {isAdmin ? (
            <>
              <div
                className="my-2 col-span-2 w-full border-t border-slate-200/90 md:my-3 md:basis-auto"
                role="separator"
                aria-hidden
              />
              <p className="mb-0.5 col-span-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent md:basis-auto">
                Quản trị
              </p>
              {renderLinks(allowedAdminLinks)}
            </>
          ) : null}
        </nav>

        <div className="mt-4 hidden md:block" />

        <div className="mb-3 hidden rounded-[var(--radius-app)] border border-emerald-200/90 bg-emerald-50/70 p-3 md:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Online Web</p>
          <p className="mt-1 text-lg font-semibold text-emerald-800">
            {onlineUsers == null ? '...' : onlineUsers.toLocaleString('vi-VN')} người
          </p>
          <p className="text-[11px] text-emerald-700/80">Tự cập nhật mỗi 30 giây</p>
        </div>

        <div className="hidden rounded-[var(--radius-app)] border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/80 to-yellow-50/70 p-3 shadow-[0_8px_24px_rgba(245,158,11,0.12)] md:block">
          <Link
            href="/dashboard/profile"
            className="block truncate text-sm font-semibold text-slate-900 hover:text-amber-700 hover:underline"
          >
            {profile?.name || '—'}
          </Link>
          <p className="mt-0.5 text-xs font-medium text-amber-700/80">
            {profile?.roleLabel || (isAdmin ? 'Admin' : 'Người dùng')}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-700">
            <div className="rounded border border-amber-100 bg-white/95 px-2 py-1 shadow-sm">
              <span className="block text-amber-600/80">Số dư</span>
              <span className="font-semibold text-slate-900">
                {Number(profile?.balance || 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="rounded border border-yellow-100 bg-white/95 px-2 py-1 shadow-sm">
              <span className="block text-yellow-700/80">VA đã tạo</span>
              <span className="font-semibold text-slate-900">{Number(profile?.createdVA || 0)}</span>
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
      </div>
    </aside>
  );
}
