import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { DashboardShell } from '@/components/DashboardShell';
import { ADMIN_PERMISSIONS, normalizeAdminPermissions } from '@/lib/server/admin-permissions';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const u = await db.getUser(session.userId);
  const dbAdminPermissions =
    session.userId === 'admin' ? [...ADMIN_PERMISSIONS] : normalizeAdminPermissions(u.adminPermissions);
  const effectiveIsAdmin = dbAdminPermissions.length > 0;
  if (session.isAdmin !== effectiveIsAdmin) {
    session.isAdmin = effectiveIsAdmin;
    session.adminPermissions = dbAdminPermissions;
    await session.save();
  }

  if (!effectiveIsAdmin) {
    if (u.isBanned === true) redirect('/banned');
    if (!u.isActive) redirect('/pending');
  }

  return (
    <DashboardShell
      isAdmin={effectiveIsAdmin}
      adminPermissions={effectiveIsAdmin ? dbAdminPermissions : []}
      profile={{
        name: u.fullName || u.username || u.webLogin || 'User',
        roleLabel: effectiveIsAdmin
          ? 'Admin'
          : u.ctvStatus === 'approved'
            ? 'CTV'
            : 'Người dùng',
        balance: u.balance,
        createdVA: u.createdVA,
      }}
    >
      {children}
    </DashboardShell>
  );
}
