'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from './DashboardNav';

export function DashboardShell({
  children,
  isAdmin,
  adminPermissions,
  currentUserId,
  profile,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
  adminPermissions?: string[];
  currentUserId?: string;
  profile?: {
    name?: string;
    roleLabel?: string;
    balance?: number;
    createdVA?: number;
  };
}) {
  const router = useRouter();

  useEffect(() => {
    // Branding note in browser devtools console.
    // Keep this concise to avoid noisy logs.
    // eslint-disable-next-line no-console
    console.log(
      '%cDev: @blackpink03 ( Telegram )\nNhận Code web, Bot theo yêu cầu',
      'color:#16a34a;font-weight:700;font-size:13px;',
    );
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col md:flex-row">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-70" aria-hidden />
      <DashboardNav
        isAdmin={isAdmin}
        adminPermissions={adminPermissions}
        currentUserId={currentUserId}
        profile={profile}
        onLogout={logout}
      />
      <div className="relative flex min-h-screen flex-1 flex-col md:ml-60">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/90 bg-surface-1/90 px-4 py-3 backdrop-blur-md md:hidden">
          <span className="text-xs font-medium text-slate-500">Sinpay Console</span>
          <button
            type="button"
            onClick={logout}
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Đăng xuất
          </button>
        </div>
        <main className="relative flex-1 px-4 py-8 sm:px-6 md:px-10 md:py-10 lg:px-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
