'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldSelectClass } from '@/components/ui';

type Service = {
  id: string;
  name: string;
  price?: number;
  timeout?: number;
};

type Row = {
  orderId: string;
  serviceName?: string;
  number?: string;
  otp?: string;
  smsContent?: string;
  price?: number;
  status?: string;
  createdAt?: number;
};

function fmtTs(ts: number | undefined) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}

export default function SimRentPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [markupPercent, setMarkupPercent] = useState(0);
  const [items, setItems] = useState<Row[]>([]);
  const [networkOptions, setNetworkOptions] = useState<string[]>([]);
  const [prefixOptions, setPrefixOptions] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const [serviceId, setServiceId] = useState('');
  const [network, setNetwork] = useState('');
  const [prefixs, setPrefixs] = useState('');
  const [excludePrefixs, setExcludePrefixs] = useState('');

  const selectedService = useMemo(
    () => services.find((x) => x.id === serviceId) || null,
    [services, serviceId],
  );

  function calcDisplayPrice(basePrice: number) {
    const base = Math.max(0, Number(basePrice) || 0);
    const raised = base * (1 + Math.max(0, Number(markupPercent) || 0) / 100);
    return Math.ceil(raised / 1000) * 1000;
  }

  async function load(nextOffset = 0, append = false) {
    if (!append) setLoading(true);
    const res = await fetch(`/api/sim-rent?limit=20&offset=${nextOffset}`, { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(d.error || 'Không tải được dữ liệu Thuê Sim'));
      if (!append) setLoading(false);
      return;
    }
    const nextServices = Array.isArray(d.services) ? d.services : [];
    setServices(nextServices);
    const nextItems = Array.isArray(d.items) ? d.items : [];
    setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
    setHasMore(Boolean(d.hasMore));
    setOffset(Number(d.nextOffset || 0));
    setMarkupPercent(Number(d.markupPercent || 0));
    setNetworkOptions(Array.isArray(d.networkOptions) ? d.networkOptions : []);
    setPrefixOptions(Array.isArray(d.prefixOptions) ? d.prefixOptions : []);
    if (!serviceId && nextServices.length) setServiceId(String(nextServices[0].id || ''));
    if (!append) setLoading(false);
  }

  useEffect(() => {
    void load(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createRent() {
    setMsg('');
    if (!serviceId) {
      setMsg('Vui lòng chọn dịch vụ');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/sim-rent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          serviceName: selectedService?.name || '',
          network: network || undefined,
          prefixs: prefixs || undefined,
          excludePrefixs: excludePrefixs || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(d.error || 'Tạo yêu cầu thất bại'));
        return;
      }
      setMsg('Tạo yêu cầu thành công.');
      await load(0, false);
    } finally {
      setCreating(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await load(offset, true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function copyText(text: string, key: string) {
    const value = String(text || '').trim();
    if (!value || value === '—') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 1200);
    } catch {
      setMsg('Không thể copy, vui lòng thử lại.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dịch vụ" title="Thuê Sim" description="Tạo yêu cầu thuê sim OTP và theo dõi trạng thái." />

      <Card padding="lg" className="space-y-4">
        <p className="text-xs text-slate-500">
          Giá dịch vụ hiển thị đã cộng {Number(markupPercent || 0)}% và làm tròn bậc 1.000đ.
        </p>
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <FieldLabel>Chọn dịch vụ</FieldLabel>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={fieldSelectClass}>
              {!services.length ? <option value="">Chưa có dịch vụ</option> : null}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} - ({calcDisplayPrice(Number(s.price || 0)).toLocaleString('vi-VN')}đ)
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Tất cả nhà mạng</FieldLabel>
            <select value={network} onChange={(e) => setNetwork(e.target.value)} className={fieldSelectClass}>
              <option value="">Tất cả nhà mạng</option>
              {networkOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Chọn đầu số</FieldLabel>
            <select value={prefixs} onChange={(e) => setPrefixs(e.target.value)} className={fieldSelectClass}>
              <option value="">Không chọn đầu số</option>
              {prefixOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Không chọn đầu số</FieldLabel>
            <select value={excludePrefixs} onChange={(e) => setExcludePrefixs(e.target.value)} className={fieldSelectClass}>
              <option value="">Không chọn</option>
              {prefixOptions.map((p) => (
                <option key={`ex-${p}`} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full" onClick={() => void createRent()} disabled={creating}>
              {creating ? 'Đang tạo...' : 'Tạo Yêu Cầu'}
            </Button>
          </div>
        </div>

        {msg ? (
          <p className={`text-sm font-medium ${msg.toLowerCase().includes('thành công') ? 'text-emerald-600' : 'text-rose-600'}`}>
            {msg}
          </p>
        ) : null}
      </Card>

      <Card padding="lg" className="border border-slate-200/90 bg-white/95 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-3">STT</th>
                <th className="px-2 py-3">Dịch vụ</th>
                <th className="px-2 py-3">Số Điện Thoại</th>
                <th className="px-2 py-3">OTP</th>
                <th className="px-2 py-3">Tin Nhắn</th>
                <th className="px-2 py-3">Phí</th>
                <th className="px-2 py-3">Trạng thái</th>
                <th className="px-2 py-3">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-6 text-slate-500" colSpan={8}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((it, idx) => (
                  <tr
                    key={String(it.orderId || idx)}
                    className="border-b border-slate-100 transition hover:bg-sky-50/40"
                  >
                    <td className="px-2 py-3">{idx + 1}</td>
                    <td className="px-2 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {String(it.serviceName || '—')}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{String(it.number || '—')}</span>
                        <button
                          type="button"
                          onClick={() => void copyText(String(it.number || ''), `phone-${it.orderId || idx}`)}
                          disabled={!String(it.number || '').trim()}
                          className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          {copiedKey === `phone-${it.orderId || idx}` ? 'Đã copy' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-700">{String(it.otp || '—')}</span>
                        <button
                          type="button"
                          onClick={() => void copyText(String(it.otp || ''), `otp-${it.orderId || idx}`)}
                          disabled={!String(it.otp || '').trim()}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                        >
                          {copiedKey === `otp-${it.orderId || idx}` ? 'Đã copy' : 'Copy'}
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3">{String(it.smsContent || '—')}</td>
                    <td className="px-2 py-3 font-semibold text-rose-600">
                      {Number(it.price || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          String(it.status || '').toUpperCase() === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-700'
                            : String(it.status || '').toUpperCase() === 'FAILED'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {String(it.status || '—')}
                      </span>
                    </td>
                    <td className="px-2 py-3">{fmtTs(Number(it.createdAt || 0))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-2 py-6 text-center text-slate-500" colSpan={8}>
                    Bạn chưa trải nghiệm dịch vụ nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-center">
          <Button type="button" variant="secondary" onClick={() => void loadMore()} disabled={!hasMore || loadingMore}>
            {loadingMore ? 'Đang tải...' : hasMore ? 'Tải Thêm' : 'Hết dữ liệu'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
