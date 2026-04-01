'use client';

import { useState } from 'react';

export function TelegramConnectCard({ initialLinked }: { initialLinked: boolean }) {
  const [linked, setLinked] = useState(initialLinked);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function openTelegramLink() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/me/telegram-link', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof d.error === 'string' ? d.error : 'Không tạo được liên kết.');
        return;
      }
      if (typeof d.url === 'string') {
        window.open(d.url, '_blank', 'noopener,noreferrer');
        setMessage('Đã mở Telegram. Trong chat với bot, bấm «Start» / «Bắt đầu». Sau đó tải lại trang này để thấy trạng thái «Đã kết nối».');
      }
    } finally {
      setBusy(false);
    }
  }

  async function refreshLinked() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/me');
      const d = await res.json().catch(() => ({}));
      const tl = d.user?.telegramLinked === true;
      setLinked(tl);
      if (tl) setMessage('Đã kết nối Telegram.');
      else setMessage('Chưa thấy liên kết — hãy hoàn tất bước Start trong bot rồi thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium text-emerald-700">Đã kết nối Telegram.</p>
        <button
          type="button"
          onClick={() => void refreshLinked()}
          disabled={busy}
          className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Kiểm tra lại
        </button>
        {message ? <p className="w-full text-xs text-slate-500">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Mở bot trong Telegram và bấm Start — không cần nhập mật khẩu trên Telegram (mã chỉ dùng một lần, hết hạn sau ~15 phút).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void openTelegramLink()}
          disabled={busy}
          className="rounded-[var(--radius-app)] bg-[#0088cc] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
        >
          {busy ? 'Đang tạo link…' : 'Kết nối Telegram'}
        </button>
        <button
          type="button"
          onClick={() => void refreshLinked()}
          disabled={busy}
          className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Đã bấm Start — kiểm tra
        </button>
      </div>
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
