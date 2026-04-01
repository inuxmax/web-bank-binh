'use client';

import { useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass, fieldSelectClass } from '@/components/ui';

export default function AdminIbftPage() {
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [sourceBank, setSourceBank] = useState<'MSB' | 'KLB' | ''>('');
  const [statusOrderId, setStatusOrderId] = useState('');
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOut('');
    try {
      const res = await fetch('/api/ibft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankCode,
          accountNumber,
          accountName,
          amount,
          remark: remark || undefined,
          sourceBank: sourceBank || undefined,
        }),
      });
      const j = await res.json();
      setOut(JSON.stringify(j, null, 2));
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOut('');
    try {
      const res = await fetch('/api/ibft/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: statusOrderId }),
      });
      const j = await res.json();
      setOut(JSON.stringify(j, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sinpay API"
        title="Chi hộ IBFT"
        description="Firm transfer môi trường thật. Nhập trực tiếp thông tin người nhận và chọn kênh nguồn theo cấu hình thật."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <Card padding="lg">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <FieldLabel>Kênh nguồn (tùy chọn)</FieldLabel>
              <select
                value={sourceBank}
                onChange={(e) => setSourceBank(e.target.value as typeof sourceBank)}
                className={fieldSelectClass}
              >
                <option value="MSB">MSB</option>
                <option value="KLB">KLB</option>
                <option value="">Mặc định merchant chính</option>
              </select>
            </div>
            <div>
              <FieldLabel>Mã NH đích</FieldLabel>
              <input
                placeholder="VCB, TCB…"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                className={fieldInputClass}
                required
              />
            </div>
            <div>
              <FieldLabel>Số tài khoản</FieldLabel>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={fieldInputClass}
                required
              />
            </div>
            <div>
              <FieldLabel>Tên chủ TK</FieldLabel>
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={fieldInputClass} required />
            </div>
            <div>
              <FieldLabel>Số tiền</FieldLabel>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} required />
            </div>
            <div>
              <FieldLabel>Ghi chú</FieldLabel>
              <input value={remark} onChange={(e) => setRemark(e.target.value)} className={fieldInputClass} />
            </div>
            <Button type="submit" disabled={loading}>
              Gửi chi hộ
            </Button>
          </form>
        </Card>

        <Card padding="lg" variant="quiet">
          <form onSubmit={checkStatus} className="space-y-5">
            <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Tra trạng thái</h2>
            <div>
              <FieldLabel>orderId</FieldLabel>
              <input
                placeholder="orderId"
                value={statusOrderId}
                onChange={(e) => setStatusOrderId(e.target.value)}
                className={fieldInputClass}
              />
            </div>
            <Button type="submit" disabled={loading} variant="secondary">
              Kiểm tra
            </Button>
          </form>
        </Card>
      </div>

      {out ? (
        <pre className="mt-8 max-h-96 overflow-auto rounded-[var(--radius-app-lg)] border border-slate-200 bg-surface-2/90 p-5 font-mono text-xs leading-relaxed text-slate-700 shadow-inner-glow">
          {out}
        </pre>
      ) : null}
    </div>
  );
}
