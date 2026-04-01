'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BannedPage() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="mt-2 max-w-md rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-8 text-center shadow-inner-glow">
        <h1 className="font-display text-xl font-semibold text-slate-900">Tài khoản đã bị khóa</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-[var(--radius-app)] bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            Đăng xuất
          </button>
          <Link
            href="/login"
            className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
