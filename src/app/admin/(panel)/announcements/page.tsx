'use client';

import { useState } from 'react';
import { Button, FieldLabel, PageHeader, fieldInputClass, useAppPopup } from '@/components/ui';

export default function AdminAnnouncementsPage() {
  const popup = useAppPopup();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendWeb, setSendWeb] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ webCount: number; telegramCount: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      await popup.alert('Bạn chưa nhập nội dung thông báo.');
      return;
    }
    setLoading(true);
    setResult(null);
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim() || undefined,
        message: message.trim(),
        sendWeb,
        sendTelegram,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      await popup.alert(String(d.error || 'Gửi thông báo thất bại'));
      return;
    }
    setResult({
      webCount: Number(d.webCount || 0),
      telegramCount: Number(d.telegramCount || 0),
    });
    await popup.alert('Đã gửi thông báo hệ thống.');
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Thông báo hệ thống"
        description="Gửi thông báo từ admin tới toàn bộ user web và bot Telegram."
      />
      <form onSubmit={submit} className="max-w-2xl space-y-4">
        <div>
          <FieldLabel>Tiêu đề (tuỳ chọn)</FieldLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldInputClass}
            placeholder="Ví dụ: Bảo trì hệ thống"
          />
        </div>
        <div>
          <FieldLabel>Nội dung</FieldLabel>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className={`${fieldInputClass} min-h-[160px]`}
            placeholder="Nhập nội dung muốn gửi..."
          />
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sendWeb} onChange={(e) => setSendWeb(e.target.checked)} />
            Gửi vào web (lịch sử số dư)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendTelegram}
              onChange={(e) => setSendTelegram(e.target.checked)}
            />
            Gửi qua Telegram bot
          </label>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Đang gửi…' : 'Gửi thông báo'}
        </Button>
        {result ? (
          <p className="text-sm text-slate-600">
            Đã gửi: web <b>{result.webCount}</b> user, Telegram <b>{result.telegramCount}</b> user.
          </p>
        ) : null}
      </form>
    </div>
  );
}

