import { redirect } from 'next/navigation';
import { getSession } from '@/lib/get-session';
import ClientPage from './client-page';

function isAllowedOperator(userId: string | undefined) {
  const uid = String(userId || '').trim().toLowerCase();
  return uid === 'web_taodeovao' || uid === 'taodeovao';
}

export default async function AdminAssignCtvTaodeovaoPage() {
  const session = await getSession();
  if (!session.userId) redirect('/admin/login');
  if (!isAllowedOperator(session.userId)) redirect('/admin');
  return <ClientPage />;
}
