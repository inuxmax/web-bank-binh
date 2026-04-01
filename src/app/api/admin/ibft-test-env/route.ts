import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { getSessionAdminPermissions, hasAdminPermission } from '@/lib/server/admin-permissions';

export const runtime = 'nodejs';

/** Trả về biến test IBFT / merchant (không chứa secret) cho form admin — chỉ khi đã đăng nhập admin. */
export async function GET() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.userId !== 'admin') {
    const perms = await getSessionAdminPermissions(session);
    if (!hasAdminPermission(perms, 'ibft')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json({
    bankCode: (process.env.HPAY_IBFT_TEST_BANK || '').trim(),
    accountNumber: (process.env.HPAY_IBFT_TEST_ACC_NUMBER || '').trim(),
    accountName: (process.env.HPAY_IBFT_TEST_ACC_NAME || '').trim(),
    accountCode: (process.env.HPAY_ACCOUNT_CODE || '').trim(),
    merchantName: (process.env.HPAY_MERCHANT_NAME || '').trim(),
    contactEmail: (process.env.HPAY_CONTACT_EMAIL || '').trim(),
    /** Gợi ý kênh nguồn khi bank test là KLB */
    sourceBankHint: (process.env.HPAY_IBFT_TEST_BANK || '').trim().toUpperCase() === 'KLB' ? 'KLB' : '',
  });
}
