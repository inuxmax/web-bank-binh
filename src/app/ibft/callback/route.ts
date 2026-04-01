import { NextResponse } from 'next/server';
import * as db from '@/lib/server/db';

export const runtime = 'nodejs';

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object') return {};
  return v as Record<string, unknown>;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = String(req.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return asRecord(await req.json().catch(() => ({})));
  }
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return {};
    const out: Record<string, unknown> = {};
    for (const [k, val] of form.entries()) out[k] = String(val);
    return out;
  }
  return {};
}

function getString(payload: Record<string, unknown>, key: string): string {
  return String(payload[key] ?? '').trim();
}

async function handleCallback(req: Request, body: Record<string, unknown>) {
  const { searchParams } = new URL(req.url);
  const merged: Record<string, unknown> = { ...Object.fromEntries(searchParams.entries()), ...body };

  await db.addIbftHistory({
    ts: Date.now(),
    adminId: 'ibft_callback',
    merchant: getString(merged, 'merchantId') || getString(merged, 'merchant_id'),
    bankCode: getString(merged, 'bankCode') || getString(merged, 'bank_code'),
    accountNumber: getString(merged, 'bankAccountNumber') || getString(merged, 'bank_account_number'),
    accountName: getString(merged, 'bankAccountName') || getString(merged, 'bank_account_name'),
    amount: toNum(merged.amount),
    orderId: getString(merged, 'orderId') || getString(merged, 'order_id'),
    tranStatus: getString(merged, 'tranStatus') || getString(merged, 'tran_status'),
    errorCode: getString(merged, 'errorCode') || getString(merged, 'error_code'),
    errorMessage: getString(merged, 'errorMessage') || getString(merged, 'error_message'),
    remark: JSON.stringify(merged).slice(0, 2000),
  });

  return NextResponse.json({ error: '00', message: 'Success' }, { status: 200 });
}

export async function GET(req: Request) {
  return handleCallback(req, {});
}

export async function POST(req: Request) {
  const body = await readBody(req);
  return handleCallback(req, body);
}

