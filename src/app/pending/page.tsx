import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { PublicNav } from '@/components/PublicNav';
import { Card, CardHeader, CardTitle } from '@/components/ui';

export default async function PendingPage() {
  const session = await getSession();
  if (!session.userId) redirect('/login');
  if (session.isAdmin) redirect('/admin');

  const u = await db.getUser(session.userId);
  if (u.isActive) redirect('/dashboard');

  return (
    <>
      <PublicNav />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-40" aria-hidden />
      <div className="mx-auto max-w-lg px-4 py-20 sm:px-6">
        <Card variant="accent" padding="lg" className="text-center">
          <CardHeader className="text-left">
            <CardTitle className="text-amber-700">Chờ duyệt</CardTitle>
          </CardHeader>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900">Tài khoản đang chờ kích hoạt</h1>
          <p className="mt-4 text-[15px] leading-7 text-slate-600">
            ID web của bạn — gửi ADMIN để bật hoạt động:
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Liên hệ Telegram admin kích hoạt:{' '}
            <a
              href="https://t.me/lieunhuyenbet"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              @lieunhuyenbet
            </a>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Liên hệ tele phụ do tele chính bị khóa cấm chat:{' '}
            <a
              href="https://t.me/lieunhuyen02"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              @lieunhuyen02
            </a>
          </p>
          <code className="mt-6 inline-block rounded-[var(--radius-app)] border border-slate-200 bg-surface-2/80 px-5 py-3 font-mono text-sm text-accent">
            {u.id}
          </code>
          <p className="mt-8 text-sm text-slate-500">
            Sau khi ADMIN Kích Hoạt, hãy{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              đăng nhập lại
            </Link>
            .
          </p>
        </Card>
      </div>
    </>
  );
}
