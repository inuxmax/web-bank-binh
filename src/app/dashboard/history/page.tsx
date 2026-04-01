import { getSession } from '@/lib/get-session';
import { redirect } from 'next/navigation';
import * as db from '@/lib/server/db';
import { PageHeader } from '@/components/ui';
import { HistoryList } from './history-list';

type RawHistory = {
  ts?: number;
  delta?: number;
  balanceAfter?: number;
  reason?: string;
  ref?: string;
};

function fmtVnd(n: number) {
  return `${(Number(n) || 0).toLocaleString('vi-VN')} đ`;
}

function pickRefBase(ref: string) {
  return String(ref || '').split(':')[0] || '';
}

export default async function BalanceHistoryPage() {
  const session = await getSession();
  if (!session.userId || session.isAdmin) redirect('/dashboard');

  const items = (await db.getUserBalanceHistory(session.userId, 500)) as RawHistory[];
  const allVa = await db.loadAll();
  const userVas = allVa.filter((r) => String(r.userId || '') === String(session.userId));
  const vaByRequest = new Map<string, Record<string, unknown>>();
  for (const v of userVas) vaByRequest.set(String(v.requestId || ''), v as Record<string, unknown>);

  const allWd = await db.loadWithdrawals();
  const userWds = allWd.filter((r) => String(r.userId || '') === String(session.userId));
  const wdById = new Map<string, Record<string, unknown>>();
  for (const w of userWds) {
    const id = String(w.id || '').trim();
    const mongoId = String(w.mongoId || '').trim();
    if (id) wdById.set(id, w);
    if (mongoId) wdById.set(mongoId, w);
  }

  const viewItems = items.map((it) => {
    const reason = String(it.reason || '').trim();
    const ref = String(it.ref || '').trim();
    const baseRef = pickRefBase(ref);
    const va = vaByRequest.get(baseRef);
    const wd = wdById.get(baseRef) || wdById.get(ref);

    let title = reason || 'Biến động số dư';
    const lines: string[] = [];

    if (reason === 'ipn') {
      title = 'Tiền vào từ VA';
      if (va) {
        lines.push(`VA: ${String(va.vaAccount || '—')} · NH: ${String(va.vaBank || '—')}`);
        lines.push(`Nội dung: ${String(va.transferContent || va.remark || '—')}`);
      }
      lines.push(`Số tiền cộng: ${fmtVnd(Number(it.delta || 0))}`);
    } else if (reason === 'withdraw_create') {
      title = 'Đã tạo lệnh rút tiền';
      if (wd) {
        lines.push(
          `Ngân hàng: ${String(wd.bankName || '—')} · STK: ${String(wd.bankAccount || '—')}`,
        );
        lines.push(`Chủ TK: ${String(wd.bankHolder || '—')}`);
        lines.push(
          `Số tiền rút: ${fmtVnd(Number(wd.amount || 0))} · Thực nhận: ${fmtVnd(Number(wd.actualReceive || 0))}`,
        );
      }
    } else if (reason === 'withdraw_done') {
      title = 'Lệnh rút tiền thành công';
      if (wd) {
        lines.push(
          `Ngân hàng: ${String(wd.bankName || '—')} · STK: ${String(wd.bankAccount || '—')}`,
        );
        lines.push(`Thực nhận: ${fmtVnd(Number(wd.actualReceive || 0))}`);
      }
    } else if (reason === 'withdraw_refund' || reason === 'withdraw_refund_reason') {
      title = 'Đã hoàn tiền lệnh rút';
      lines.push(`Số tiền hoàn: ${fmtVnd(Number(it.delta || 0))}`);
    } else if (reason === 'withdraw_reject' || reason === 'withdraw_reject_wrong') {
      title = 'Lệnh rút bị từ chối';
      if (wd) lines.push(`Lệnh rút: ${String(wd.id || '—')} · NH: ${String(wd.bankName || '—')}`);
    } else if (reason.startsWith('withdraw_reject_note:')) {
      title = 'Lệnh rút bị từ chối';
      lines.push(`Lý do: ${reason.slice('withdraw_reject_note:'.length).trim() || '—'}`);
    } else if (reason.startsWith('admin_notice')) {
      title = 'Thông báo từ admin';
      const msg = reason.replace(/^admin_notice(?::)?/i, '').trim();
      if (msg) lines.push(msg);
    } else {
      lines.push('Chi tiết đang được cập nhật thêm');
    }

    return {
      ts: Number(it.ts || 0),
      delta: Number(it.delta || 0),
      balanceAfter: Number(it.balanceAfter || 0),
      title,
      reason: reason || '—',
      ref,
      lines,
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Lịch sử"
        title="Biến động số dư"
        description="Hiển thị chi tiết theo từng giao dịch (VA, lệnh rút, cộng/trừ tiền) và phân trang."
      />
      {viewItems.length === 0 ? (
        <div className="rounded-[var(--radius-app-lg)] border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          Chưa có dòng lịch sử.
        </div>
      ) : (
        <HistoryList items={viewItems} />
      )}
    </div>
  );
}
