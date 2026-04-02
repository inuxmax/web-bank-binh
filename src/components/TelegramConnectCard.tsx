'use client';

import { useState } from 'react';

export function TelegramConnectCard({ initialLinked }: { initialLinked: boolean }) {
  const [linked, setLinked] = useState(initialLinked);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string>('');

  async function openTelegramLink() {
    // Open tab immediately in user-gesture context for mobile browsers.
    const popup = window.open('', '_blank');
    setBusy(true);
    setMessage(null);
    setManualUrl('');
    try {
      const res = await fetch('/api/me/telegram-link', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (popup && !popup.closed) popup.close();
        setMessage(typeof d.error === 'string' ? d.error : 'Không tạo được liên kết.');
        return;
      }
      if (typeof d.url === 'string') {
        if (popup && !popup.closed) {
          try {
            popup.opener = null;
          } catch {}
          popup.location.replace(d.url);
        } else {
          // Popup bị chặn: giữ nguyên trang hiện tại, cho user bấm link thủ công.
          setManualUrl(d.url);
        }
        setMessage('Đã mở Telegram. Trong chat với bot, bấm «Start» / «Bắt đầu». Sau đó tải lại trang này để thấy trạng thái «Đã kết nối».');
      } else if (popup && !popup.closed) {
        popup.close();
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

  async function unlinkTelegram() {
    const ok = window.confirm('Bạn muốn huỷ liên kết Telegram khỏi tài khoản web này?');
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/me/telegram-link', { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof d.error === 'string' ? d.error : 'Không thể huỷ liên kết Telegram.');
        return;
      }
      setLinked(false);
      setMessage('Đã huỷ liên kết Telegram.');
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
        <button
          type="button"
          onClick={() => void unlinkTelegram()}
          disabled={busy}
          className="rounded-[var(--radius-app)] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          Huỷ liên kết Telegram
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
      {manualUrl ? (
        <a
          href={manualUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-[var(--radius-app)] border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
        >
          Mở Telegram thủ công
        </a>
      ) : null}
      {message ? <p className="text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
