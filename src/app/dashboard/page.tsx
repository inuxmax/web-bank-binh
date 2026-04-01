import Link from 'next/link';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { formatDateTimeVN } from '@/lib/server/va-helpers';
import { PageHeader, ArrowLink, Card, CardHeader, CardTitle, StatTile } from '@/components/ui';
import { TelegramConnectCard } from '@/components/TelegramConnectCard';

export default async function DashboardPage() {
  const session = await getSession();
  const isAdmin = !!session.isAdmin;
  let balance = 0;
  const userId = session.userId || '';

  let vaTotal = 0;
  let vaPaid = 0;
  let vaUnpaid = 0;
  let telegramLinked = false;
  const recentVa: {
    requestId: string;
    vaAccount?: string;
    status?: string;
    name?: string;
    createdAt?: number;
  }[] = [];

  if (!isAdmin && userId) {
    const userRow = await db.getUser(userId);
    balance = userRow.balance;
    telegramLinked = !!userRow.telegramId;

    const all = await db.loadAll();
    const mine = all.filter((r) => String(r.userId || '') === userId);
    vaTotal = mine.length;
    vaPaid = mine.filter((r) => String(r.status) === 'paid').length;
    vaUnpaid = mine.filter((r) => String(r.status) !== 'paid').length;
    recentVa.push(
      ...mine
        .map((r) => ({
          requestId: String(r.requestId || ''),
          vaAccount: r.vaAccount != null ? String(r.vaAccount) : undefined,
          status: r.status != null ? String(r.status) : undefined,
          name: r.name != null ? String(r.name) : undefined,
          createdAt: r.createdAt != null ? Number(r.createdAt) : undefined,
        }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 4),
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Tổng quan"
        description={
          isAdmin
            ? 'Chế độ quản trị: quản lý người dùng, rút tiền, số dư Sinpay và chi hộ IBFT từ menu bên trái.'
            : 'Tổng Quan Chi phí phí rút, phí giao dịch, phí chuyển, phí hoa hồng CTV, phí hoa hồng Referral, phí hoa hồng Admin.'
        }
      />

      {!isAdmin && (
        <>
          <a
            href="https://t.me/+KGa5re77U0w2MDY9"
            target="_blank"
            rel="noreferrer"
            className="group mb-6 block rounded-[var(--radius-app-lg)] border border-emerald-300/70 bg-gradient-to-r from-emerald-500 via-accent to-sky-500 p-[1px] shadow-[0_16px_36px_-18px_rgba(16,185,129,0.75)]"
          >
            <div className="rounded-[calc(var(--radius-app-lg)-1px)] bg-white px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Telegram Group</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                Tham Gia Group để nhận thông báo mới nhất
              </p>
              <p className="mt-2 text-sm font-medium text-accent group-hover:underline">
                Vào nhóm ngay: https://t.me/+KGa5re77U0w2MDY9
              </p>
            </div>
          </a>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Số dư khả dụng"
              value={
                <span className="bg-gradient-to-br from-slate-900 via-slate-800 to-accent bg-clip-text text-transparent">
                  {balance.toLocaleString('vi-VN')} đ
                </span>
              }
              hint="Đồng bộ từ Virtual Account và các lệnh rút / hoàn."
              action={<ArrowLink href="/dashboard/withdraw">Rút tiền</ArrowLink>}
            />
            <StatTile
              label="Virtual Account"
              value={vaTotal.toLocaleString('vi-VN')}
              hint="Tổng VA bạn đã tạo trong hệ thống."
              action={<ArrowLink href="/dashboard/va/new">Tạo VA mới</ArrowLink>}
            />
            <StatTile
              label="Trạng thái VA"
              value={
                <span className="text-xl sm:text-2xl">
                  <span className="text-emerald-600">{vaPaid}</span>
                  <span className="mx-2 text-slate-400">/</span>
                  <span className="text-amber-600">{vaUnpaid}</span>
                </span>
              }
              hint="Đã thanh toán · Chưa thanh toán (ước lượng theo trạng thái lưu trữ)."
              action={<ArrowLink href="/dashboard/va">Xem tất cả VA</ArrowLink>}
            />
          </div>

          <Card className="mt-6" padding="lg">
            <CardHeader>
              <CardTitle>Telegram</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Dùng bot Sinpay trên điện thoại cùng tài khoản đăng nhập này (tạo VA, rút tiền, v.v.).
              </p>
            </CardHeader>
            <TelegramConnectCard initialLinked={telegramLinked} />
          </Card>

          <div className="mt-10 grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3" padding="lg">
              <CardHeader>
                <CardTitle>VA gần đây</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  Bốn mã gần nhất — kiểm tra nhanh trước khi chia sẻ QR.
                </p>
              </CardHeader>
              {recentVa.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có Virtual Account nào. Bắt đầu bằng một mã mới.</p>
              ) : (
                <ul className="space-y-2">
                  {recentVa.map((row) => (
                    <li
                      key={row.requestId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-app)] border border-slate-200/90 bg-surface-0/80 px-4 py-3"
                    >
                      <div>
                        <p className="font-mono text-sm text-accent">{row.vaAccount || '—'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.name || '—'}
                          {row.createdAt ? ` · ${formatDateTimeVN(row.createdAt)}` : ''}
                        </p>
                      </div>
                      <span
                        className={
                          row.status === 'paid'
                            ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80'
                            : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80'
                        }
                      >
                        {row.status || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="lg:col-span-2" variant="quiet" padding="lg">
              <CardHeader>
                <CardTitle>Lối tắt</CardTitle>
              </CardHeader>
              <ul className="space-y-3 text-[15px]">
                <li>
                  <Link
                    href="/dashboard/history"
                    className="flex items-center justify-between rounded-[var(--radius-app)] border border-transparent px-1 py-2 text-slate-600 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  >
                    Lịch sử số dư
                    <span className="text-accent">→</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/va"
                    className="flex items-center justify-between rounded-[var(--radius-app)] border border-transparent px-1 py-2 text-slate-600 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  >
                    Danh sách VA
                    <span className="text-accent">→</span>
                  </Link>
                </li>
              </ul>
            </Card>
          </div>
        </>
      )}

      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card variant="accent" padding="lg">
            <CardHeader>
              <CardTitle className="text-accent/80">Quản trị</CardTitle>
            </CardHeader>
            <p className="text-[15px] leading-7 text-slate-600">
              Dùng menu: <strong className="font-medium text-slate-900">Người dùng</strong>,{' '}
              <strong className="font-medium text-slate-900">Rút tiền</strong>,{' '}
              <strong className="font-medium text-slate-900">Số dư Sinpay</strong>,{' '}
              <strong className="font-medium text-slate-900">Chi hộ</strong>.
            </p>
          </Card>
          <Card padding="lg">
            <CardHeader>
              <CardTitle>IPN callback</CardTitle>
            </CardHeader>
            <p className="text-sm text-slate-600">
              Đặt URL công khai trỏ về endpoint sau (GET/POST tùy cấu hình cổng):
            </p>
            <code className="mt-3 block rounded-[var(--radius-app)] border border-slate-200 bg-surface-2/80 px-4 py-3 font-mono text-sm text-accent">
              /api/ipn/va
            </code>
          </Card>
        </div>
      )}
    </div>
  );
}
