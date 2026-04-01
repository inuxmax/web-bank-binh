import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import * as db from '@/lib/server/db';
import { isUserBanned, USER_BANNED_MESSAGE } from '@/lib/server/user-guard';

export const runtime = 'nodejs';

const BASE_URL = 'https://bossotp.net';
const NETWORK_OPTIONS = ['VIETTEL', 'MOBIFONE', 'VINAPHONE', 'VIETNAMOBILE', 'GMOBILE'];
const PREFIX_OPTIONS = [
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '52',
  '56',
  '58',
  '59',
  '70',
  '76',
  '77',
  '78',
  '79',
  '81',
  '82',
  '83',
  '84',
  '85',
  '86',
  '87',
  '88',
  '89',
  '90',
  '91',
  '92',
  '93',
  '94',
  '95',
  '96',
  '97',
  '98',
  '99',
];

const createSchema = z.object({
  serviceId: z.string().min(1),
  serviceName: z.string().optional(),
  network: z.string().optional(),
  prefixs: z.string().optional(),
  excludePrefixs: z.string().optional(),
});

function pickToken(cfg: Record<string, unknown>) {
  return String(cfg.simRentApiToken || '').trim();
}

function pickMarkup(cfg: Record<string, unknown>) {
  const n = Number(cfg.simRentMarkupPercent ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function applyMarkup(basePrice: number, markupPercent: number) {
  const base = Math.max(0, Number(basePrice) || 0);
  const pct = Math.max(0, Number(markupPercent) || 0);
  const raised = base * (1 + pct / 100);
  const roundStep = 1000;
  return Math.ceil(raised / roundStep) * roundStep;
}

function toQuery(input: Record<string, unknown>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    const val = String(v ?? '').trim();
    if (!val) continue;
    q.set(k, val);
  }
  return q.toString();
}

async function bossGet(path: string, query: Record<string, unknown>) {
  const url = `${BASE_URL}${path}?${toQuery(query)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function normalizeServiceItem(raw: Record<string, unknown>) {
  const id = String(raw._id || raw.id || raw.service_id || '').trim();
  const name = String(raw.name || raw.service_name || raw.code || id).trim();
  const price = Number(raw.price || 0);
  const timeout = Number(raw.timeout || 0);

  return {
    id,
    name,
    price: Number.isFinite(price) ? price : 0,
    timeout: Number.isFinite(timeout) ? timeout : 0,
    raw,
  };
}

async function refreshPending(userId: string, token: string, markupPercent: number) {
  const pending = await db.getPendingSimRentOrdersByUser(userId, 12);
  for (const r of pending) {
    const rentId = String(r.rentId || '').trim();
    if (!rentId) continue;
    const checked = await bossGet('/api/v4/rents/check', {
      _id: rentId,
      api_token: token,
    });
    if (!checked.ok) continue;
    const x = (checked.json || {}) as Record<string, unknown>;
    const basePrice = Number(x.price || r.basePrice || r.price || 0);
    await db.updateSimRentOrderByRentId(userId, rentId, {
      status: String(x.status || r.status || 'PENDING'),
      number: String(x.number || r.number || ''),
      otp: String(x.otp || ''),
      smsContent: String(x.sms_content || ''),
      basePrice,
      price: applyMarkup(basePrice, markupPercent),
      markupPercent,
      isSentSms: Boolean(x.isSentSms),
      statusDescription: String(x.status_description || ''),
      providerRaw: x,
    });
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const u = await db.getUser(session.userId);
  if (isUserBanned(u)) return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
  if (!u.isActive) return NextResponse.json({ error: 'Tài khoản chưa được duyệt' }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 20)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));

  const cfg = await db.getConfig();
  const token = pickToken(cfg);
  const markupPercent = pickMarkup(cfg);
  if (!token) {
    return NextResponse.json({ error: 'Chưa cấu hình API key Thuê Sim trong admin.' }, { status: 400 });
  }

  await refreshPending(session.userId, token, markupPercent);

  const [servicesResV4, balanceRes, orders, total] = await Promise.all([
    bossGet('/api/v4/service-manager/services', {}),
    bossGet('/api/v4/users/me/balance', { api_token: token }),
    db.getSimRentOrdersByUser(session.userId, limit, offset),
    db.countSimRentOrdersByUser(session.userId),
  ]);

  const servicesRaw = Array.isArray(servicesResV4.json)
    ? servicesResV4.json
    : Array.isArray((servicesResV4.json as { data?: unknown[] })?.data)
      ? ((servicesResV4.json as { data?: unknown[] }).data as unknown[])
      : [];
  const services = servicesRaw
    .filter((x) => x && typeof x === 'object')
    .map((x) => normalizeServiceItem(x as Record<string, unknown>))
    .filter((x) => x.id);

  return NextResponse.json({
    services,
    networkOptions: NETWORK_OPTIONS,
    prefixOptions: PREFIX_OPTIONS,
    balance: Number((balanceRes.json as { balance?: number })?.balance || 0),
    items: orders,
    markupPercent,
    total,
    hasMore: offset + orders.length < total,
    nextOffset: offset + orders.length,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const u = await db.getUser(session.userId);
  if (isUserBanned(u)) return NextResponse.json({ error: USER_BANNED_MESSAGE }, { status: 403 });
  if (!u.isActive) return NextResponse.json({ error: 'Tài khoản chưa được duyệt' }, { status: 403 });

  const cfg = await db.getConfig();
  const token = pickToken(cfg);
  const markupPercent = pickMarkup(cfg);
  if (!token) {
    return NextResponse.json({ error: 'Chưa cấu hình API key Thuê Sim trong admin.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const created = await bossGet('/api/v4/rents/create', {
      api_token: token,
      service_id: data.serviceId,
      network: data.network || '',
      prefixs: data.prefixs || '',
      exclude_prefixs: data.excludePrefixs || '',
    });
    if (!created.ok) {
      const msg = String((created.json as { error?: string })?.error || 'Tạo yêu cầu thất bại');
      return NextResponse.json({ error: msg, provider: created.json }, { status: 400 });
    }
    const row = created.json as Record<string, unknown>;
    const rentId = String(row.rent_id || row._id || '');
    const number = String(row.number || '');
    const basePrice = Number(row.price || 0);
    const saved = await db.addSimRentOrder({
      userId: session.userId,
      serviceId: data.serviceId,
      serviceName: String(data.serviceName || ''),
      network: String(data.network || ''),
      prefixs: String(data.prefixs || ''),
      excludePrefixs: String(data.excludePrefixs || ''),
      rentId,
      number,
      status: 'PENDING',
      basePrice,
      price: applyMarkup(basePrice, markupPercent),
      markupPercent,
      providerRaw: row,
    });
    return NextResponse.json({ ok: true, item: saved });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ error: (e as Error).message || 'Lỗi hệ thống' }, { status: 500 });
  }
}
