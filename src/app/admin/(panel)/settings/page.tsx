'use client';

import { useEffect, useState } from 'react';
import { Button, PageHeader, FieldLabel, fieldInputClass } from '@/components/ui';

export default function AdminSettingsPage() {
  const [globalFeePercent, setGlobalFeePercent] = useState('0');
  const [ipnFeeFlat, setIpnFeeFlat] = useState('4000');
  const [withdrawFeeFlat, setWithdrawFeeFlat] = useState('4000');
  const [ctvCommissionPercent, setCtvCommissionPercent] = useState('1');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    void fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const cfg = (d && d.config) || {};
        if (cfg.globalFeePercent !== undefined) setGlobalFeePercent(String(cfg.globalFeePercent));
        if (cfg.ipnFeeFlat !== undefined) setIpnFeeFlat(String(cfg.ipnFeeFlat));
        if (cfg.withdrawFeeFlat !== undefined) setWithdrawFeeFlat(String(cfg.withdrawFeeFlat));
        if (cfg.ctvCommissionPercent !== undefined) setCtvCommissionPercent(String(cfg.ctvCommissionPercent));
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setErr('');
    const payload = {
      globalFeePercent: Number(globalFeePercent),
      ctvCommissionPercent: Number(ctvCommissionPercent),
      ipnFeeFlat: Number(ipnFeeFlat),
      withdrawFeeFlat: Number(withdrawFeeFlat),
    };
    const hasInvalid = Object.values(payload).some((n) => !Number.isFinite(n) || n < 0);
    if (hasInvalid) {
      setErr('Giá trị nhập không hợp lệ.');
      return;
    }
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(String(d.error || 'Lưu cấu hình thất bại'));
      return;
    }
    const cfg = (d && d.config) || {};
    if (cfg.globalFeePercent !== undefined) setGlobalFeePercent(String(cfg.globalFeePercent));
    if (cfg.ctvCommissionPercent !== undefined) setCtvCommissionPercent(String(cfg.ctvCommissionPercent));
    if (cfg.ipnFeeFlat !== undefined) setIpnFeeFlat(String(cfg.ipnFeeFlat));
    if (cfg.withdrawFeeFlat !== undefined) setWithdrawFeeFlat(String(cfg.withdrawFeeFlat));
    setMsg('Đã lưu cấu hình chung.');
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Cấu hình phí"
        description="Áp dụng toàn hệ thống (trừ khi override từng user trong DB)."
      />
      <form onSubmit={save} className="mt-2 max-w-md space-y-5">
        <div>
          <FieldLabel>Phí rút % (globalFeePercent)</FieldLabel>
          <input
            type="number"
            value={globalFeePercent}
            onChange={(e) => setGlobalFeePercent(e.target.value)}
            className={fieldInputClass}
          />
        </div>
        <div>
          <FieldLabel>% hoa hồng CTV (global)</FieldLabel>
          <input
            type="number"
            value={ctvCommissionPercent}
            onChange={(e) => setCtvCommissionPercent(e.target.value)}
            className={fieldInputClass}
          />
        </div>
        <div>
          <FieldLabel>Phí tiền về IPN (đ)</FieldLabel>
          <input type="number" value={ipnFeeFlat} onChange={(e) => setIpnFeeFlat(e.target.value)} className={fieldInputClass} />
        </div>
        <div>
          <FieldLabel>Phí chuyển rút (đ)</FieldLabel>
          <input
            type="number"
            value={withdrawFeeFlat}
            onChange={(e) => setWithdrawFeeFlat(e.target.value)}
            className={fieldInputClass}
          />
        </div>
        <Button type="submit">Lưu</Button>
        {err ? <p className="text-sm font-medium text-rose-500">{err}</p> : null}
        {msg ? <p className="text-sm font-medium text-emerald-400">{msg}</p> : null}
      </form>
    </div>
  );
}
