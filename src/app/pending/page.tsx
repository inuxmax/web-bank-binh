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
            ID web của bạn — gửi admin để bật hoạt động (tương tự Telegram ID trong bot):
          </p>
          <code className="mt-6 inline-block rounded-[var(--radius-app)] border border-slate-200 bg-surface-2/80 px-5 py-3 font-mono text-sm text-accent">
            {u.id}
          </code>
          <p className="mt-8 text-sm text-slate-500">
            Sau khi admin bật <span className="text-slate-400">isActive</span>, hãy{' '}
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
