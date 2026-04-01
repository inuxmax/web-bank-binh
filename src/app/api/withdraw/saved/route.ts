import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { IBFT_BANKS, getIbftBankLabel } from '@/lib/banks';

export const runtime = 'nodejs';

type SavedWithdrawAccount = {
  bankCode: string;
  bankAccount: string;
  bankHolder: string;
  updatedAt: number;
};

function normalizeSavedWithdrawAccounts(raw: unknown): SavedWithdrawAccount[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        bankCode: String(row.bankCode || '').trim().toUpperCase(),
        bankAccount: String(row.bankAccount || '')
          .replace(/[^\d]/g, '')
          .slice(0, 24),
        bankHolder: String(row.bankHolder || '').trim(),
        updatedAt: Number(row.updatedAt) || 0,
      };
    })
    .filter((r) => r.bankCode && r.bankAccount.length >= 6 && r.bankHolder)
    .slice(0, 8);
}

function normalizeText(s: string) {
  return String(s || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function inferBankCode(row: Record<string, unknown>): string {
  const direct = String(row.bankCode || '').trim().toUpperCase();
  if (direct && IBFT_BANKS.some((b) => b.code === direct)) return direct;
  const name = normalizeText(String(row.bankName || ''));
  if (!name) return '';
  const found = IBFT_BANKS.find((b) => {
    const code = normalizeText(b.code);
    const rawName = normalizeText(b.name);
    const label = normalizeText(getIbftBankLabel(b.code));
    return name === code || name === rawName || name === label || name.includes(code) || code.includes(name);
  });
  return found?.code || '';
}

export async function GET() {
  const session = await getSession();
  if (!session.userId || session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await db.getUser(session.userId);
  const fromUser = normalizeSavedWithdrawAccounts(user.savedWithdrawAccounts);
  const allWithdrawals = await db.loadWithdrawals();
  const fromWithdrawals = normalizeSavedWithdrawAccounts(
    allWithdrawals
      .filter((w) => String(w.userId || '') === String(session.userId))
      .map((w) => {
        const row = w as Record<string, unknown>;
        return {
          bankCode: inferBankCode(row),
          bankAccount: row.bankAccount,
          bankHolder: row.bankHolder,
          updatedAt: Number(row.createdAt) || Date.now(),
        };
      }),
  );
  const dedup = new Map<string, SavedWithdrawAccount>();
  for (const it of [...fromUser, ...fromWithdrawals]) {
    const key = `${it.bankCode}|${it.bankAccount}`;
    if (!dedup.has(key)) dedup.set(key, it);
  }
  const items = [...dedup.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);
  return NextResponse.json({
    ok: true,
    items,
  });
}

