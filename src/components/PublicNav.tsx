import Link from 'next/link';

export function PublicNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-surface-1/85 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-xs font-bold text-accent">
            H
          </span>
          Sinpay <span className="text-accent">Console</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/chinh-sach-dieu-khoan"
            className="rounded-[var(--radius-app)] px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Chính sách
          </Link>
          <Link
            href="/login"
            className="rounded-[var(--radius-app)] px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="rounded-[var(--radius-app)] bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-glow transition hover:brightness-[1.03]"
          >
            Đăng ký
          </Link>
        </nav>
      </div>
    </header>
  );
}
