import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { DashboardShell } from '@/components/DashboardShell';
import * as db from '@/lib/server/db';
import { ADMIN_PERMISSIONS, getSessionAdminPermissions } from '@/lib/server/admin-permissions';

function isTaodeovaoOperator(userId: string | undefined) {
  const uid = String(userId || '').trim().toLowerCase();
  return uid === 'web_taodeovao' || uid === 'taodeovao';
}

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/admin/login');
  const allowSpecial = isTaodeovaoOperator(session.userId);
  const adminPermissions =
    session.userId === 'admin' ? [...ADMIN_PERMISSIONS] : await getSessionAdminPermissions(session);
  if (!adminPermissions.length && !allowSpecial) redirect('/dashboard');
  if (!session.isAdmin) {
    session.isAdmin = true;
    session.adminPermissions = adminPermissions.length ? adminPermissions : undefined;
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
