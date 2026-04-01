'use client';

import { useMemo, useState, type FormEvent } from 'react';
import * as XLSX from 'xlsx';
import { randomName } from '@/lib/names';
import { Button, PageHeader, fieldInputClass, fieldSelectClass, useAppPopup } from '@/components/ui';

type BulkRow = {
  index: number;
  inputName: string;
  ok: boolean;
  error?: string;
  requestId?: string;
  vaAccount?: string;
  vaBank?: string;
  vaName?: string;
  vaAmount?: string;
  quickLink?: string;
  remark?: string;
};

export default function AdminVaBulkPage() {
  const popup = useAppPopup();
  const [quantity, setQuantity] = useState('10');
  const [bankCode, setBankCode] = useState<'MSB' | 'KLB' | 'BIDV' | ''>('MSB');
  const [randomNames, setRandomNames] = useState(true);
  const [baseName, setBaseName] = useState(randomName());
  const [nameListText, setNameListText] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ total: number; success: number; failed: number } | null>(null);

  const successRows = useMemo(() => rows.filter((r) => r.ok), [rows]);

  function parseQuantity(): number {
    const q = Number(quantity);
    if (!Number.isFinite(q)) return 0;
    return q;
  }

  function generateNamesByQuantity(q: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < q; i += 1) out.push(randomName());
    return out;
  }

  function normalizeManualNames(): string[] {
    return nameListText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
  }

  function randomizeNameList() {
    const q = parseQuantity();
    if (!Number.isFinite(q) || q < 1 || q > 100) {
      void popup.alert('Số lượng phải từ 1 đến 100 để random danh sách tên.');
      return;
    }
    const names = generateNamesByQuantity(q);
    setNameListText(names.join('\n'));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = parseQuantity();
    if (!Number.isFinite(q) || q < 1 || q > 100) {
      await popup.alert('Số lượng phải từ 1 đến 100.');
      return;
    }
    const manualNames = normalizeManualNames();
    let finalNames = manualNames;
    if (randomNames) {
      if (manualNames.length !== q) {
        finalNames = generateNamesByQuantity(q);
        setNameListText(finalNames.join('\n'));
      }
    } else if (manualNames.length && manualNames.length !== q) {
      await popup.alert('Danh sách tên đang không khớp số lượng VA. Vui lòng nhập đủ hoặc đúng số dòng.');
      return;
    }

    setLoading(true);
    setRows([]);
    setSummary(null);
    const res = await fetch('/api/admin/va-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: q,
        bankCode,
        randomNames,
        baseName: baseName.trim() || undefined,
        names: finalNames,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      await popup.alert(String(d.error || 'Tạo VA hàng loạt thất bại'));
      return;
    }
    setRows(Array.isArray(d.items) ? (d.items as BulkRow[]) : []);
    setSummary({
      total: Number(d.total || 0),
      success: Number(d.success || 0),
      failed: Number(d.failed || 0),
    });
  }

  function exportExcel() {
    if (!successRows.length) {
      void popup.alert('Chưa có dữ liệu thành công để xuất Excel.');
      return;
    }
    const sheetRows = successRows.map((r) => ({
      STT: r.index,
      'Tên nhập': r.inputName,
      'Số TK VA': r.vaAccount || '',
      'Ngân hàng': r.vaBank || '',
      'Tên TK': r.vaName || '',
      'Số tiền': r.vaAmount || '',
      'Nội dung CK': r.remark || '',
      requestId: r.requestId || '',
      'QR Link': r.quickLink || '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(wb, ws, 'VA');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    XLSX.writeFile(wb, `sinpay-va-bulk-${ts}.xlsx`);
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Tạo VA số lượng lớn"
        description="Tạo nhiều Virtual Account theo lô, có random tên và xuất kết quả ra file Excel."
      />

      <form onSubmit={submit} className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Số lượng VA</span>
            <input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`${fieldInputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Ngân hàng VA</span>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value as typeof bankCode)}
              className={`${fieldSelectClass} mt-1`}
            >
              <option value="MSB">MSB</option>
              <option value="KLB">KLB</option>
              <option value="BIDV">BIDV</option>
              <option value="">Tự động theo cấu hình</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={randomNames}
              onChange={(e) => setRandomNames(e.target.checked)}
            />
            Random tên cho từng VA
          </label>
          <Button type="button" size="sm" variant="secondary" onClick={() => setBaseName(randomName())}>
            Random tên mẫu
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={randomizeNameList}>
            Random đúng số lượng
          </Button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">Tên mẫu (khi tắt random từng VA)</span>
          <input
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            className={`${fieldInputClass} mt-1`}
            placeholder="Nguyen Van A"
            disabled={randomNames}
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-600">
            Danh sách tên ({normalizeManualNames().length} dòng)
          </span>
          <textarea
            value={nameListText}
            onChange={(e) => setNameListText(e.target.value)}
            className={`${fieldInputClass} mt-1 min-h-36`}
            placeholder="Mỗi dòng 1 tên. Nếu bật random, hệ thống sẽ tự sinh đúng số dòng theo số lượng VA."
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Đang tạo…' : 'Tạo VA hàng loạt'}
          </Button>
          <Button type="button" variant="secondary" onClick={exportExcel}>
            Xuất VA thành Excel
          </Button>
        </div>
      </form>

      {summary ? (
        <div className="mt-4 rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Tổng: <b>{summary.total}</b> · Thành công: <b className="text-emerald-700">{summary.success}</b> ·
          Lỗi: <b className="text-rose-700">{summary.failed}</b>
        </div>
      ) : null}

      {rows.length ? (
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 shadow-inner-glow">
          <table className="w-full min-w-[900px] text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 bg-surface-2/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3">STT</th>
                <th className="p-3">Tên</th>
                <th className="p-3">STK VA</th>
                <th className="p-3">Ngân hàng</th>
                <th className="p-3">RequestId</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.requestId || r.inputName}-${i}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="p-3">{r.index}</td>
                  <td className="p-3">{r.inputName}</td>
                  <td className="p-3 font-mono text-xs text-accent">{r.vaAccount || '—'}</td>
                  <td className="p-3">{r.vaBank || '—'}</td>
                  <td className="p-3 font-mono text-xs">{r.requestId || '—'}</td>
                  <td className="p-3">
                    {r.ok ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Thành công</span>
                    ) : (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Lỗi</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-rose-700">{r.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

