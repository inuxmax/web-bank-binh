'use client';

import { useState } from 'react';
import Image from 'next/image';
import { randomName } from '@/lib/names';
import { buildSepayQrUrlClient, displayVaBankClient } from '@/lib/va-display';
import { Button, Card, CardHeader, CardTitle, FieldLabel, PageHeader, fieldInputClass, fieldSelectClass } from '@/components/ui';

export default function NewVaPage() {
  const [name, setName] = useState('');
  const [bankCode, setBankCode] = useState<'MSB' | 'KLB' | 'BIDV' | ''>('MSB');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{
    decoded: Record<string, string | undefined>;
    requestId: string;
    sepayUrl?: string;
  } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        bankCode: bankCode || '',
        remark: remark.trim() || undefined,
      };

      const res = await fetch('/api/va/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Lỗi');
        return;
      }
      const decoded = data.decoded as Record<string, string | undefined>;
      const sepayUrl = buildSepayQrUrlClient({
        acc: decoded.vaAccount,
        bank: String(decoded.vaBank || bankCode || '').trim().toUpperCase(),
        amount: decoded.vaAmount,
        des: decoded.remark || remark,
        template: 'qronly',
      });
      setResult({ decoded, requestId: data.requestId, sepayUrl });
    } finally {
      setLoading(false);
    }
  }

  return (
      <div>
        <PageHeader
          eyebrow="Sinpay API"
          title="Tạo Virtual Account"
        description="Tên sẽ được tự động chuẩn hóa sang không dấu trước khi gửi API."
        />

        <div className="grid gap-8 lg:grid-cols-5">
          <Card className="lg:col-span-3" padding="lg">
            <form onSubmit={submit} className="space-y-6">
              <div>
                <FieldLabel>Tên chủ VA</FieldLabel>
                <div className="mt-2 flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${fieldInputClass} flex-1`}
                    placeholder="Nguyen Van A"
                    required
                  />
                  <Button type="button" variant="secondary" onClick={() => setName(randomName())} size="sm" className="shrink-0">
                    Ngẫu nhiên
                  </Button>
                </div>
              </div>
              <div>
                <FieldLabel>Ngân hàng VA</FieldLabel>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value as typeof bankCode)}
                  className={fieldSelectClass}
                >
                  <option value="MSB">MSB</option>
                  <option value="KLB">KLB</option>
                  <option value="BIDV">BIDV (bảo trì / hạn chế)</option>
                  <option value="">Tự động theo cấu hình</option>
                </select>
              </div>
              <div>
                <FieldLabel>Nội dung CK (tùy chọn)</FieldLabel>
                <input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Để trống = không có nội dung"
                />
              </div>
              {err ? <p className="text-sm font-medium text-rose-400">{err}</p> : null}
              <Button type="submit" disabled={loading}>
                {loading ? 'Đang gọi API…' : 'Tạo VA'}
              </Button>
            </form>
          </Card>

          <div className="lg:col-span-2">
            {result ? (
              <Card variant="accent" padding="lg">
                <CardHeader>
                  <CardTitle className="text-accent/90">Đã tạo</CardTitle>
                </CardHeader>
                <p className="text-xs font-mono text-slate-500">requestId: {result.requestId}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  <li>
                    Ngân hàng: {displayVaBankClient(result.decoded, bankCode || undefined)} (
                    {result.decoded.vaBank || bankCode})
                  </li>
                  <li>Tên TK: {result.decoded.vaName}</li>
                  <li>Số TK: {result.decoded.vaAccount}</li>
                  <li>Nội dung: {result.decoded.remark || '—'}</li>
                </ul>
                {result.sepayUrl ? (
                  <div className="mt-6 flex flex-col items-start gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">QR Sepay</p>
                    <Image
                      src={result.sepayUrl}
                      alt="QR"
                      width={220}
                      height={220}
                      unoptimized
                      className="rounded-[var(--radius-app)] border border-slate-200"
                    />
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card variant="quiet" padding="lg" className="h-full min-h-[200px]">
                <p className="text-sm leading-relaxed text-slate-500">
                  Sau khi tạo thành công, mã VA và QR hiển thị tại đây để sao chép hoặc chia sẻ.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
  );
}
