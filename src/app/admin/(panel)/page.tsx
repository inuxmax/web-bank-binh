import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { getSession } from '@/lib/get-session';
import {
  ADMIN_PERMISSION_LABELS,
  type AdminPermission,
  getSessionAdminPermissions,
} from '@/lib/server/admin-permissions';
import { getVaSyncStatus } from '@/lib/server/va-sync-poller';
import { AdminStatsOverview } from '@/components/AdminStatsOverview';

export default async function AdminHomePage() {
  const session = await getSession();
  const callbackBase = String(
    process.env.HPAY_CALLBACK_BASE_URL ||
      process.env.CALLBACK_BASE_URL ||
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      '',
  )
    .trim()
    .replace(/\/$/, '');
  const callbackUrl = callbackBase ? `${callbackBase}/api/ipn/va` : '/api/ipn/va';
  const permissions =
    session.userId === 'admin'
      ? (Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermission[])
      : await getSessionAdminPermissions(session);
  const cards: { href: string; perm: AdminPermission; t: string; d: string }[] = [
    { href: '/admin/users', perm: 'users', t: 'Người dùng', d: 'Kích hoạt, phí, giới hạn VA' },
    { href: '/admin/withdrawals', perm: 'withdrawals', t: 'Rút tiền', d: 'Pending, duyệt, từ chối, hoàn' },
    { href: '/admin/ctv', perm: 'ctv', t: 'Quản lý CTV', d: 'Duyệt CTV và theo dõi thu nhập' },
    { href: '/admin/va-bulk', perm: 'va_bulk', t: 'Tạo VA hàng loạt', d: 'Tạo nhiều VA nhanh và xuất Excel' },
    { href: '/admin/announcements', perm: 'announcements', t: 'Thông báo', d: 'Gửi thông báo cho user web + bot Telegram' },
    { href: '/admin/balance', perm: 'balance', t: 'Số dư Sinpay', d: 'API get-balance + lịch sử snapshot' },
    { href: '/admin/ibft', perm: 'ibft', t: 'Chi hộ IBFT', d: 'FirmBanking transfer + tra trạng thái' },
    { href: '/admin/ibft/history', perm: 'ibft_history', t: 'Lịch sử chi hộ', d: 'Xem log chi hộ gần đây' },
    { href: '/admin/settings', perm: 'settings', t: 'Cấu hình', d: 'Phí chung, % hoa hồng CTV, giới hạn VA toàn hệ thống' },
    { href: '/admin/permissions', perm: 'permissions', t: 'Phân quyền', d: 'Cấp quyền admin theo module' },
  ];
  const visibleCards = cards.filter((c) => permissions.includes(c.perm));
  const syncStatus = getVaSyncStatus();
  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Quản trị"
        description="Các module tương ứng bot Telegram — OAuth, RSA và dữ liệu dùng chung với web."
      />
      <AdminStatsOverview />
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleCards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-6 shadow-card shadow-inner-glow backdrop-blur-xl transition duration-300 hover:border-accent/30 hover:shadow-card-hover"
          >
            <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">{c.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{c.d}</p>
            <span className="mt-4 inline-flex text-sm font-medium text-accent opacity-0 transition group-hover:opacity-100">
              Mở →
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-4 rounded-[var(--radius-app)] border border-slate-200/90 bg-surface-2/60 px-4 py-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-800">VA Sync Poller</span>{' '}
        {syncStatus.enabled ? 'đang bật' : 'đang tắt'} · Lần quét gần nhất:{' '}
        <span className="font-medium text-slate-800">
          {syncStatus.lastRunAt ? new Date(syncStatus.lastRunAt).toLocaleString('vi-VN') : 'chưa có'}
        </span>{' '}
        · Bản ghi vừa sync:{' '}
        <span className="font-medium text-emerald-700">{Number(syncStatus.lastSynced || 0)}</span>
      </div>
      <p className="mt-12 rounded-[var(--radius-app)] border border-slate-200/90 bg-surface-2/60 px-4 py-3 text-xs text-slate-600">
        Callback IPN:{' '}
        <code className="font-mono text-accent">{callbackUrl}</code>
      </p>
    </div>
  );
}
