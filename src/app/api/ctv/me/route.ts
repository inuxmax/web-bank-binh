import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

function getBaseUrl(req: Request) {
  return (
    String(process.env.NEXT_PUBLIC_APP_URL || '').trim() ||
    String(process.env.APP_BASE_URL || '').trim() ||
    new URL(req.url).origin
  );
}

function makeRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'CTV';
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUniqueReferralCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = makeRandomCode();
    const exists = await db.findUserByCtvCode(code);
    if (!exists) return code;
  }
  return `CTV${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId || session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const me = await db.getUser(session.userId);
  const cfg = await db.getConfig();
  const cfgRate = Number((cfg as { ctvCommissionPercent?: number }).ctvCommissionPercent);
  const users = await db.getAllUsers();
  const myReferrals = users.filter((u) => String(u.referredByUserId || '') === me.id);
  const referralMap = new Map(myReferrals.map((u) => [u.id, u]));
  const referralIds = new Set(myReferrals.map((u) => u.id));
  const allVa = await db.loadAll();
  const referralUserList = myReferrals.map((u) => {
    const paidVaCount = allVa.filter(
      (r) => String(r.status || '') === 'paid' && String(r.userId || '') === u.id,
    ).length;
    return {
      id: u.id,
      username: u.webLogin || u.username || '—',
      fullName: u.fullName || '',
      isActive: Boolean(u.isActive),
      registerAt: Number(u.registerAt || 0),
      paidVaCount,
    };
  });
  const paidCount = allVa.filter(
    (r) => String(r.status || '') === 'paid' && referralIds.has(String(r.userId || '')),
  ).length;

  const isApproved = me.ctvStatus === 'approved';
  let shareCode = '';
  if (isApproved) {
    shareCode = String(me.ctvCode || '').trim();
    if (!shareCode) {
      shareCode = await generateUniqueReferralCode();
      try {
        await db.updateUser(me.id, { ctvCode: shareCode });
      } catch {
        // In case another request set it first, read back and keep that stable code.
        const fresh = await db.getUser(me.id);
        shareCode = String(fresh.ctvCode || '').trim();
        if (!shareCode) throw new Error('Không thể tạo mã chia sẻ');
      }
    }
  }
  const baseUrl = getBaseUrl(req);
  const shareLink = shareCode ? `${baseUrl}/register?ref=${encodeURIComponent(shareCode)}` : '';
  const balanceHistory = await db.getUserBalanceHistory(me.id, 200);
  const commissionHistory = balanceHistory
    .filter((h) => String(h.reason || '') === 'ctv_commission')
    .slice(0, 80)
    .map((h) => {
      const refRaw = String(h.ref || '');
      const refBase = refRaw.split(':')[0] || refRaw;
      const va = allVa.find((r) => String(r.requestId || '') === refBase);
      const sourceUserId = String(va?.userId || '');
      const sourceUser = referralMap.get(sourceUserId);
      return {
        ts: Number(h.ts || 0),
        amount: Number(h.delta || 0),
        ref: refRaw,
        requestId: refBase,
        vaAccount: String(va?.vaAccount || ''),
        bankName: String(va?.vaBank || ''),
        sourceUserId,
        sourceUsername: sourceUser?.webLogin || sourceUser?.username || sourceUserId || '—',
      };
    });

  return NextResponse.json({
    status: me.ctvStatus || 'none',
    isApproved,
    shareCode,
    shareLink,
    referralUsers: myReferrals.length,
    referredUsers: referralUserList,
    paidCount,
    commissionTotal: Number(me.ctvCommissionTotal || 0),
    commissionCount: Number(me.ctvCommissionCount || 0),
    commissionHistory,
    ratePercent: Number(
      me.ctvRatePercent ??
        (Number.isFinite(cfgRate) ? cfgRate : undefined) ??
        process.env.CTV_COMMISSION_PERCENT ??
        1,
    ),
  });
}

