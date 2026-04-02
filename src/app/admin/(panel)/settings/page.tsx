'use client';

import { useEffect, useState } from 'react';
import { Button, PageHeader, FieldLabel, fieldInputClass } from '@/components/ui';

type BackupFileMeta = {
  fileName: string;
  sizeBytes: number;
  modifiedAtTs: number;
};

export default function AdminSettingsPage() {
  const [globalFeePercent, setGlobalFeePercent] = useState('0');
  const [ipnFeeFlat, setIpnFeeFlat] = useState('4000');
  const [withdrawFeeFlat, setWithdrawFeeFlat] = useState('4000');
  const [minWithdrawAmount, setMinWithdrawAmount] = useState('10000');
  const [ctvCommissionPercent, setCtvCommissionPercent] = useState('1');
  const [globalVaLimit, setGlobalVaLimit] = useState('');
  const [autoApproveNewUsers, setAutoApproveNewUsers] = useState(false);
  const [simRentApiToken, setSimRentApiToken] = useState('');
  const [simRentMarkupPercent, setSimRentMarkupPercent] = useState('0');
  const [simRentBalance, setSimRentBalance] = useState<number | null>(null);
  const [mongoBackupAutoEnabled, setMongoBackupAutoEnabled] = useState(true);
  const [mongoBackupIntervalMinutes, setMongoBackupIntervalMinutes] = useState('360');
  const [mongoBackupKeepFiles, setMongoBackupKeepFiles] = useState('20');
  const [backupFiles, setBackupFiles] = useState<BackupFileMeta[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusyFile, setRestoreBusyFile] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function loadSimRentBalance() {
    const res = await fetch('/api/admin/sim-rent/balance', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setSimRentBalance(Number(d.balance || 0));
    }
  }

  async function loadBackupFiles() {
    const res = await fetch('/api/admin/backup/mongo', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(String(d.error || 'Không tải được danh sách backup'));
      return;
    }
    setBackupFiles(Array.isArray(d.files) ? d.files : []);
  }

  useEffect(() => {
    void fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const cfg = (d && d.config) || {};
        if (cfg.globalFeePercent !== undefined) setGlobalFeePercent(String(cfg.globalFeePercent));
        if (cfg.ipnFeeFlat !== undefined) setIpnFeeFlat(String(cfg.ipnFeeFlat));
        if (cfg.withdrawFeeFlat !== undefined) setWithdrawFeeFlat(String(cfg.withdrawFeeFlat));
        if (cfg.minWithdrawAmount !== undefined) setMinWithdrawAmount(String(cfg.minWithdrawAmount));
        if (cfg.ctvCommissionPercent !== undefined) setCtvCommissionPercent(String(cfg.ctvCommissionPercent));
        setGlobalVaLimit(cfg.globalVaLimit == null ? '' : String(cfg.globalVaLimit));
        setAutoApproveNewUsers(Boolean(cfg.autoApproveNewUsers));
        setSimRentApiToken(String(cfg.simRentApiToken || ''));
        setSimRentMarkupPercent(String(cfg.simRentMarkupPercent ?? 0));
        setMongoBackupAutoEnabled(Boolean(cfg.mongoBackupAutoEnabled ?? true));
        setMongoBackupIntervalMinutes(String(cfg.mongoBackupIntervalMinutes ?? 360));
        setMongoBackupKeepFiles(String(cfg.mongoBackupKeepFiles ?? 20));
      })
      .catch(() => {
        /* keep defaults */
      });
    void loadSimRentBalance();
    void loadBackupFiles();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setErr('');
    const parsedGlobalVaLimit = globalVaLimit.trim() === '' ? null : Number(globalVaLimit);
    const payload = {
      globalFeePercent: Number(globalFeePercent),
      ctvCommissionPercent: Number(ctvCommissionPercent),
      ipnFeeFlat: Number(ipnFeeFlat),
      withdrawFeeFlat: Number(withdrawFeeFlat),
      minWithdrawAmount: Number(minWithdrawAmount),
      globalVaLimit: parsedGlobalVaLimit,
      autoApproveNewUsers,
      simRentApiToken: String(simRentApiToken || '').trim(),
      simRentMarkupPercent: Number(simRentMarkupPercent),
      mongoBackupAutoEnabled,
      mongoBackupIntervalMinutes: Number(mongoBackupIntervalMinutes),
      mongoBackupKeepFiles: Number(mongoBackupKeepFiles),
    };
    const hasInvalid =
      !Number.isFinite(payload.globalFeePercent) ||
      payload.globalFeePercent < 0 ||
      !Number.isFinite(payload.ctvCommissionPercent) ||
      payload.ctvCommissionPercent < 0 ||
      !Number.isFinite(payload.ipnFeeFlat) ||
      payload.ipnFeeFlat < 0 ||
      !Number.isFinite(payload.withdrawFeeFlat) ||
      payload.withdrawFeeFlat < 0 ||
      !Number.isFinite(payload.minWithdrawAmount) ||
      payload.minWithdrawAmount < 0 ||
      !Number.isFinite(payload.simRentMarkupPercent) ||
      payload.simRentMarkupPercent < 0 ||
      !Number.isFinite(payload.mongoBackupIntervalMinutes) ||
      payload.mongoBackupIntervalMinutes < 10 ||
      !Number.isFinite(payload.mongoBackupKeepFiles) ||
      payload.mongoBackupKeepFiles < 1 ||
      (payload.globalVaLimit !== null &&
        (!Number.isFinite(payload.globalVaLimit) || payload.globalVaLimit < 1));
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
    if (cfg.minWithdrawAmount !== undefined) setMinWithdrawAmount(String(cfg.minWithdrawAmount));
    setGlobalVaLimit(cfg.globalVaLimit == null ? '' : String(cfg.globalVaLimit));
    setAutoApproveNewUsers(Boolean(cfg.autoApproveNewUsers));
    setSimRentApiToken(String(cfg.simRentApiToken || ''));
    setSimRentMarkupPercent(String(cfg.simRentMarkupPercent ?? 0));
    setMongoBackupAutoEnabled(Boolean(cfg.mongoBackupAutoEnabled ?? true));
    setMongoBackupIntervalMinutes(String(cfg.mongoBackupIntervalMinutes ?? 360));
    setMongoBackupKeepFiles(String(cfg.mongoBackupKeepFiles ?? 20));
    await loadSimRentBalance();
    await loadBackupFiles();
    setMsg('Đã lưu cấu hình chung.');
  }

  async function createBackupNow() {
    setErr('');
    setMsg('');
    setBackupBusy(true);
    try {
      const res = await fetch('/api/admin/backup/mongo', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(String(d.error || 'Tạo backup thất bại'));
        return;
      }
      await loadBackupFiles();
      setMsg(`Đã tạo backup: ${String(d.fileName || '')}`);
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreBackup(fileName: string) {
    const ok = window.confirm(`Khôi phục dữ liệu từ file "${fileName}"?\nHệ thống sẽ ghi đè dữ liệu hiện tại.`);
    if (!ok) return;
    setErr('');
    setMsg('');
    setRestoreBusyFile(fileName);
    try {
      const res = await fetch('/api/admin/backup/mongo/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(String(d.error || 'Khôi phục thất bại'));
        return;
      }
      await loadBackupFiles();
      setMsg(
        `Khôi phục thành công (${Number(d.restoredCollections || 0)} collections, ${Number(
          d.restoredDocuments || 0,
        ).toLocaleString('vi-VN')} bản ghi).`,
      );
    } finally {
      setRestoreBusyFile('');
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Cấu hình"
        description="Áp dụng toàn hệ thống (trừ khi override theo từng user)."
      />
      <form onSubmit={save} className="mt-2 max-w-md space-y-5">
        <div>
          <FieldLabel>Mongo backup tự động</FieldLabel>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mongoBackupAutoEnabled}
              onChange={(e) => setMongoBackupAutoEnabled(e.target.checked)}
            />
            <span>{mongoBackupAutoEnabled ? 'ON - tự động backup MongoDB' : 'OFF - chỉ backup thủ công'}</span>
          </label>
        </div>
        <div>
          <FieldLabel>Chu kỳ backup tự động (phút)</FieldLabel>
          <input
            type="number"
            value={mongoBackupIntervalMinutes}
            onChange={(e) => setMongoBackupIntervalMinutes(e.target.value)}
            className={fieldInputClass}
            placeholder="360"
          />
        </div>
        <div>
          <FieldLabel>Giữ lại tối đa bao nhiêu file backup</FieldLabel>
          <input
            type="number"
            value={mongoBackupKeepFiles}
            onChange={(e) => setMongoBackupKeepFiles(e.target.value)}
            className={fieldInputClass}
            placeholder="20"
          />
        </div>
        <div className="space-y-2 rounded-[var(--radius-app)] border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Backup/Restore MongoDB</p>
            <button
              type="button"
              onClick={createBackupNow}
              disabled={backupBusy}
              className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {backupBusy ? 'Đang backup...' : 'Backup ngay'}
            </button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {backupFiles.length ? (
              backupFiles.map((f) => (
                <div
                  key={f.fileName}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                >
                  <div>
                    <p className="font-medium text-slate-800">{f.fileName}</p>
                    <p>
                      {new Date(Number(f.modifiedAtTs || 0)).toLocaleString('vi-VN')} -{' '}
                      {(Number(f.sizeBytes || 0) / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreBackup(f.fileName)}
                    disabled={restoreBusyFile === f.fileName}
                    className="inline-flex items-center rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {restoreBusyFile === f.fileName ? 'Đang restore...' : 'Restore'}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">Chưa có file backup nào.</p>
            )}
          </div>
        </div>
        <div>
          <FieldLabel>Duyệt user tự động</FieldLabel>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={autoApproveNewUsers}
              onChange={(e) => setAutoApproveNewUsers(e.target.checked)}
            />
            <span>
              {autoApproveNewUsers
                ? 'ON - user đăng ký mới được tự động kích hoạt'
                : 'OFF - user đăng ký mới phải chờ admin kích hoạt'}
            </span>
          </label>
        </div>
        <div>
          <FieldLabel>API key Thuê Sim (bossotp)</FieldLabel>
          <input
            type="text"
            value={simRentApiToken}
            onChange={(e) => setSimRentApiToken(e.target.value)}
            className={fieldInputClass}
            placeholder="Nhập api_token từ bossotp"
          />
        </div>
        <div className="rounded-[var(--radius-app)] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Số dư API Thuê Sim hiện tại:{' '}
          <span className="font-semibold text-emerald-700">
            {simRentBalance == null ? 'Đang tải...' : `${Number(simRentBalance).toLocaleString('vi-VN')} đ`}
          </span>
        </div>
        <div>
          <FieldLabel>% nâng giá Thuê Sim</FieldLabel>
          <input
            type="number"
            value={simRentMarkupPercent}
            onChange={(e) => setSimRentMarkupPercent(e.target.value)}
            className={fieldInputClass}
            placeholder="Ví dụ: 10"
          />
        </div>
        <div>
          <FieldLabel>Giới hạn tạo VA cho tất cả user</FieldLabel>
          <input
            type="number"
            value={globalVaLimit}
            onChange={(e) => setGlobalVaLimit(e.target.value)}
            className={fieldInputClass}
            placeholder="Để trống = không giới hạn"
          />
        </div>
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
        <div>
          <FieldLabel>Min rút tiền (đ)</FieldLabel>
          <input
            type="number"
            value={minWithdrawAmount}
            onChange={(e) => setMinWithdrawAmount(e.target.value)}
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
