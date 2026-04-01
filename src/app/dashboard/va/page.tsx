'use client';

import { useEffect, useState } from 'react';
import { formatDateTimeVNClient } from '@/lib/va-display';
import { getIbftBankLabel } from '@/lib/banks';
import { Card, PageHeader, useAppPopup } from '@/components/ui';

type Row = Record<string, unknown>;

function toMoney(v: unknown) {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pickString(r: Row, keys: string[]) {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

function resolveQrUrl(r: Row) {
  const quick = pickString(r, ['quickLink']);
  if (/^https?:\/\//i.test(quick)) return quick;
  const qr = pickString(r, ['qrCode']);
  if (/^https?:\/\//i.test(qr)) return qr;
  return '';
}

export default function VaListPage() {
  const popup = useAppPopup();
  const [items, setItems] = useState<Row[]>([]);
  const [searchVaAccount, setSearchVaAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [qrModal, setQrModal] = useState<{ url: string; vaAccount: string } | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetch('/api/va/list?limit=100')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  const filteredItems = items.filter((r) => {
    const key = searchVaAccount.trim();
    if (!key) return true;
    return String(r.vaAccount || '').includes(key);
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filteredItems.slice(start, start + pageSize);

  async function downloadQr(url: string, vaAccount: string) {
    setQrBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không tải được ảnh QR');
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = obj;
      a.download = `va-qr-${vaAccount || 'image'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch {
      await popup.alert('Không tải được QR. Thử lại sau.');
    } finally {
      setQrBusy(false);
    }
  }

  async function copyQr(url: string) {
    setQrBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không tải được ảnh QR');
      const blob = await res.blob();
      if (!('clipboard' in navigator) || !('ClipboardItem' in window)) {
        throw new Error('Clipboard không hỗ trợ');
      }
      const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
      await navigator.clipboard.write([item]);
      await popup.alert('Đã copy ảnh QR vào clipboard.');
    } catch {
      await popup.alert('Không copy được ảnh QR trên trình duyệt này.');
    } finally {
      setQrBusy(false);
    }
  }

  async function copyText(label: string, value: string) {
    const txt = String(value || '').trim();
    if (!txt) {
      await popup.alert(`Không có dữ liệu để copy: ${label}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(txt);
      await popup.alert(`Đã copy ${label}.`);
    } catch {
      await popup.alert(`Không copy được ${label} trên trình duyệt này.`);
    }
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Virtual Account"
        title="VA đã tạo"
        description="Danh sách gần nhất."
      />
      <Card padding="md" className="mb-6 max-w-md">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Tìm kiếm
        </label>
        <input
          value={searchVaAccount}
          onChange={(e) => {
            setSearchVaAccount(e.target.value.replace(/[^\d]/g, ''));
            setPage(1);
          }}
          className="mt-2 w-full rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm"
          placeholder="Nhập STK VA đã tạo..."
        />
      </Card>
      {loading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có bản ghi.</p>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {pageItems.map((r) => (
              <li
                key={String(r.requestId)}
                className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 px-5 py-4 text-sm text-slate-700 shadow-inner-glow transition hover:border-slate-300"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="text-slate-500">STK: </span>
                        <span className="font-mono text-accent">{String(r.vaAccount || '—')}</span>
                        <button
                          type="button"
                          onClick={() => void copyText('STK', String(r.vaAccount || ''))}
                          className="ml-2 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          Copy
                        </button>
                      </p>
                      <p>
                        <span className="text-slate-500">Ngân hàng: </span>
                        <span className="font-medium">{getIbftBankLabel(String(r.vaBank || '')) || '—'}</span>
                        <button
                          type="button"
                          onClick={() =>
                            void copyText('ngân hàng', getIbftBankLabel(String(r.vaBank || '')) || '')
                          }
                          className="ml-2 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          Copy
                        </button>
                      </p>
                      <p>
                        <span className="text-slate-500">Tên TK: </span>
                        <span>{pickString(r, ['name', 'vaName']) || '—'}</span>
                        <button
                          type="button"
                          onClick={() => void copyText('tên tài khoản', pickString(r, ['name', 'vaName']) || '')}
                          className="ml-2 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          Copy
                        </button>
                      </p>
                      <p>
                        <span className="text-slate-500">Số tiền: </span>
                        <span className="font-semibold text-slate-800">
                          {toMoney(r.netAmount ?? r.amount ?? r.vaAmount).toLocaleString('vi-VN')} đ
                        </span>
                      </p>
                      <p className="sm:col-span-2">
                        <span className="text-slate-500">Thời gian: </span>
                        <span>
                          {r.timePaid
                            ? formatDateTimeVNClient(Number(r.timePaid))
                            : r.createdAt
                              ? formatDateTimeVNClient(Number(r.createdAt))
                              : '—'}
                        </span>
                      </p>
                      <p className="sm:col-span-2">
                        <span className="text-slate-500">Nội dung CK: </span>
                        <span>{pickString(r, ['transferContent', 'remark']) || '—'}</span>
                      </p>
                      <p className="sm:col-span-2">
                        <span className="text-slate-500">Mã yêu cầu: </span>
                        <span className="font-mono text-xs">{String(r.requestId || '—')}</span>
                      </p>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-500">Trạng thái: </span>
                      <span
                        className={
                          String(r.status) === 'paid'
                            ? 'rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400'
                            : 'rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400'
                        }
                      >
                        {String(r.status || '')}
                      </span>
                    </div>
                  </div>
                  <div className="w-[92px] shrink-0">
                    {resolveQrUrl(r) ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQrModal({
                            url: resolveQrUrl(r),
                            vaAccount: String(r.vaAccount || ''),
                          })
                        }
                        className="rounded-lg border border-slate-200 transition hover:border-accent/40"
                      >
                        <img
                          src={resolveQrUrl(r)}
                          alt="QR VA"
                          className="h-[92px] w-[92px] rounded-lg object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-[92px] w-[92px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] text-slate-400">
                        QR
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Trang {safePage}/{totalPages} · {filteredItems.length} VA
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </div>
      )}

      {qrModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <button type="button" className="absolute inset-0" onClick={() => setQrModal(null)} aria-label="Đóng" />
          <div className="relative z-10 w-full max-w-sm rounded-[var(--radius-app-lg)] border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-medium text-slate-800">QR VA {qrModal.vaAccount || '—'}</p>
            <div className="mt-3 flex justify-center">
              <img src={qrModal.url} alt="QR lớn" className="h-72 w-72 rounded-xl border border-slate-200 object-contain" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyQr(qrModal.url)}
                disabled={qrBusy}
                className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              >
                Copy ảnh
              </button>
              <button
                type="button"
                onClick={() => void downloadQr(qrModal.url, qrModal.vaAccount)}
                disabled={qrBusy}
                className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
              >
                Tải về
              </button>
              <button
                type="button"
                onClick={() => setQrModal(null)}
                className="rounded-[var(--radius-app)] bg-accent px-3 py-1.5 text-sm font-medium text-on-accent"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
