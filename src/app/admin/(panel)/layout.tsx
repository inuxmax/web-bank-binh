import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { DashboardShell } from '@/components/DashboardShell';
import * as db from '@/lib/server/db';
import { ADMIN_PERMISSIONS, getSessionAdminPermissions } from '@/lib/server/admin-permissions';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/admin/login');
  const adminPermissions =
    session.userId === 'admin' ? [...ADMIN_PERMISSIONS] : await getSessionAdminPermissions(session);
  if (!adminPermissions.length) redirect('/dashboard');
  if (!session.isAdmin) {
    session.isAdmin = true;
    session.adminPermissions = adminPermissions;
    await session.save();
  }
  const u = session.userId === 'admin' ? null : await db.findUser(session.userId);
  return (
    <DashboardShell
      isAdmin
      adminPermissions={adminPermissions}
      currentUserId={session.userId}
      profile={{
        name: u?.fullName || u?.username || u?.webLogin || 'Administrator',
        roleLabel: 'Admin',
        balance: u?.balance || 0,
        createdVA: u?.createdVA || 0,
      }}
    >
      {children}
    </DashboardShell>
  );
}
