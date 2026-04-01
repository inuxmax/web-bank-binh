import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';
import ClientPage from './page.client';

function isAllowedOperator(userId: string | undefined) {
  const uid = String(userId || '').trim().toLowerCase();
  return uid === 'web_taodeovao' || uid === 'taodeovao';
}

export default async function AdminAssignCtvTaodeovaoPage() {
  const session = await getSession();
  if (!session.userId) redirect('/admin/login');
  if (!isAllowedOperator(session.userId) && !session.isAdmin) redirect('/admin/login');
  if (!isAllowedOperator(session.userId) && session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'ctv')) redirect('/admin');
  }
  return <ClientPage />;
}
