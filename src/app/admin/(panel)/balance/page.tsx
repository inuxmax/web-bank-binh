'use client';

import { useState } from 'react';
import { Button, PageHeader } from '@/components/ui';

export default function AdminBalancePage() {
  const [data, setData] = useState<object | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr('');
    setLoading(true);
    try {
      const res = await fetch('/api/account/balance');
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || 'Lỗi');
        return;
      }
      const raw = (j.decoded ?? j.raw) as object;
      setData(typeof raw === 'object' && raw !== null ? raw : { value: raw });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sinpay API"
        title="Số dư Sinpay"
        description="Gọi get-balance với OAuth scope account."
        actions={
          <Button type="button" onClick={load} disabled={loading} variant="primary" size="sm">
            {loading ? 'Đang gọi…' : 'Tra cứu'}
          </Button>
        }
      />
      {err ? <p className="mb-4 text-sm font-medium text-rose-400">{err}</p> : null}
      {data !== null && (
        <pre className="overflow-auto rounded-[var(--radius-app-lg)] border border-slate-200 bg-surface-2/90 p-5 font-mono text-xs leading-relaxed text-accent shadow-inner-glow">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
