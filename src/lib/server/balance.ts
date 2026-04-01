import 'server-only';

import * as db from './db';

function toAmountNumber(v: unknown) {
  const n = Number(String(v || '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Đồng bộ số dư user từ bản ghi VA đã thanh toán và lệnh rút (giống bot) */
export async function computeUserBalanceFromRecords(userId: string) {
  const uid = String(userId);
  let all = await db.loadAll();
  try {
    const vaToUser = new Map<string, string>();
    for (const r of all) {
      const acc = String(r.vaAccount || '').trim();
      const u = String(r.userId || '').trim();
      if (acc && u) vaToUser.set(acc, u);
    }
    let changed = false;
    for (const r of all) {
      if (String(r.status) !== 'paid') continue;
      if (r.userId) continue;
      const acc = String(r.vaAccount || '').trim();
      const u = vaToUser.get(acc);
      if (acc && u) {
        await db.upsert({ ...r, requestId: r.requestId, userId: u });
        r.userId = u;
        changed = true;
      }
    }
    const myAccounts = new Set(
      all
        .filter((r) => String(r.userId) === uid && String(r.vaAccount || '').trim())
        .map((r) => String(r.vaAccount).trim()),
    );
    for (const r of all) {
      if (String(r.status) !== 'paid') continue;
      const acc = String(r.vaAccount || '').trim();
      if (!r.userId && acc && myAccounts.has(acc)) {
        await db.upsert({ ...r, requestId: r.requestId, userId: uid });
        r.userId = uid;
        changed = true;
      }
    }
    if (changed) all = await db.loadAll();
  } catch {
    /* ignore */
  }
  const myAccounts = new Set(
    all
      .filter((r) => String(r.userId) === uid && String(r.vaAccount || '').trim())
      .map((r) => String(r.vaAccount).trim()),
  );
  const vas = all.filter(
    (r) =>
      String(r.status) === 'paid' &&
      (String(r.userId) === uid ||
        (String(r.vaAccount || '').trim() && myAccounts.has(String(r.vaAccount).trim()))),
  );
  const totalPaid = vas.reduce((sum, r) => sum + toAmountNumber(r.netAmount || r.amount || r.vaAmount), 0);
  const wds = (await db.loadWithdrawals()).filter(
    (w) => String(w.userId) === uid && String(w.status) !== 'reject',
  );
  const totalWithdraw = wds.reduce((sum, w) => sum + toAmountNumber(w.amount), 0);
  const balance = Math.max(0, totalPaid - totalWithdraw);
  return { totalPaid, totalWithdraw, balance };
}
