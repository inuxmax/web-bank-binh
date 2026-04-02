'use client';

import { useEffect, useState } from 'react';
import { Button, FieldLabel, PageHeader, fieldInputClass, useAppPopup } from '@/components/ui';

type PopupConfig = {
  dashboardPopupEnabled: boolean;
  dashboardPopupTitle: string;
  dashboardPopupBody: string;
  dashboardPopupPrimaryLabel: string;
  dashboardPopupPrimaryUrl: string;
  dashboardPopupSecondaryLabel: string;
  dashboardPopupSecondaryUrl: string;
};

const defaultPopupConfig: PopupConfig = {
  dashboardPopupEnabled: false,
  dashboardPopupTitle: '',
  dashboardPopupBody: '',
  dashboardPopupPrimaryLabel: '',
  dashboardPopupPrimaryUrl: '',
  dashboardPopupSecondaryLabel: '',
  dashboardPopupSecondaryUrl: '',
};

export default function AdminAnnouncementsPage() {
  const popup = useAppPopup();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendWeb, setSendWeb] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ webCount: number; telegramCount: number } | null>(null);
  const [popupConfig, setPopupConfig] = useState<PopupConfig>(defaultPopupConfig);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupSaving, setPopupSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setPopupLoading(true);
      const res = await fetch('/api/admin/announcements', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      setPopupLoading(false);
      if (!mounted || !res.ok) return;
      const p = (d.popup || {}) as Record<string, unknown>;
      setPopupConfig({
        dashboardPopupEnabled: p.dashboardPopupEnabled === true,
        dashboardPopupTitle: String(p.dashboardPopupTitle || ''),
        dashboardPopupBody: String(p.dashboardPopupBody || ''),
        dashboardPopupPrimaryLabel: String(p.dashboardPopupPrimaryLabel || ''),
        dashboardPopupPrimaryUrl: String(p.dashboardPopupPrimaryUrl || ''),
        dashboardPopupSecondaryLabel: String(p.dashboardPopupSecondaryLabel || ''),
        dashboardPopupSecondaryUrl: String(p.dashboardPopupSecondaryUrl || ''),
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

  async function savePopupConfig(e: React.FormEvent) {
    e.preventDefault();
    setPopupSaving(true);
    const res = await fetch('/api/admin/announcements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(popupConfig),
    });
    const d = await res.json().catch(() => ({}));
    setPopupSaving(false);
    if (!res.ok) {
      await popup.alert(String(d.error || 'Lưu cấu hình popup thất bại'));
      return;
    }
    await popup.alert('Đã lưu popup Dashboard user.');
  }

  return (
    <div>
      <popup.PopupHost />
      <PageHeader
        eyebrow="Admin"
        title="Thông báo hệ thống"
        description="Gửi thông báo từ admin tới toàn bộ user web và bot Telegram."
      />
      <div className="space-y-8">
        <form onSubmit={savePopupConfig} className="max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-base font-semibold text-slate-900">Popup Dashboard user</p>
            <p className="text-sm text-slate-600">
              Cài nội dung popup hiện khi user mở Dashboard. Phần này tách biệt với thông báo cũ.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={popupConfig.dashboardPopupEnabled}
              onChange={(e) =>
                setPopupConfig((prev) => ({
                  ...prev,
                  dashboardPopupEnabled: e.target.checked,
                }))
              }
            />
            Bật popup trên Dashboard user
          </label>
          <div>
            <FieldLabel>Tiêu đề popup</FieldLabel>
            <input
              value={popupConfig.dashboardPopupTitle}
              onChange={(e) =>
                setPopupConfig((prev) => ({
                  ...prev,
                  dashboardPopupTitle: e.target.value,
                }))
              }
              className={fieldInputClass}
              placeholder="Ví dụ: 📣 KÊNH THÔNG BÁO CHÍNH THỨC"
            />
          </div>
          <div>
            <FieldLabel>Nội dung popup</FieldLabel>
            <textarea
              value={popupConfig.dashboardPopupBody}
              onChange={(e) =>
                setPopupConfig((prev) => ({
                  ...prev,
                  dashboardPopupBody: e.target.value,
                }))
              }
              rows={6}
              className={`${fieldInputClass} min-h-[150px]`}
              placeholder="Nhập nội dung hiển thị nổi bật cho user..."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Nút chính - Nội dung</FieldLabel>
              <input
                value={popupConfig.dashboardPopupPrimaryLabel}
                onChange={(e) =>
                  setPopupConfig((prev) => ({
                    ...prev,
                    dashboardPopupPrimaryLabel: e.target.value,
                  }))
                }
                className={fieldInputClass}
                placeholder="KÊNH TELEGRAM"
              />
            </div>
            <div>
              <FieldLabel>Nút chính - Link</FieldLabel>
              <input
                value={popupConfig.dashboardPopupPrimaryUrl}
                onChange={(e) =>
                  setPopupConfig((prev) => ({
                    ...prev,
                    dashboardPopupPrimaryUrl: e.target.value,
                  }))
                }
                className={fieldInputClass}
                placeholder="https://t.me/..."
              />
            </div>
            <div>
              <FieldLabel>Nút phụ - Nội dung</FieldLabel>
              <input
                value={popupConfig.dashboardPopupSecondaryLabel}
                onChange={(e) =>
                  setPopupConfig((prev) => ({
                    ...prev,
                    dashboardPopupSecondaryLabel: e.target.value,
                  }))
                }
                className={fieldInputClass}
                placeholder="SUB18.VN"
              />
            </div>
            <div>
              <FieldLabel>Nút phụ - Link</FieldLabel>
              <input
                value={popupConfig.dashboardPopupSecondaryUrl}
                onChange={(e) =>
                  setPopupConfig((prev) => ({
                    ...prev,
                    dashboardPopupSecondaryUrl: e.target.value,
                  }))
                }
                className={fieldInputClass}
                placeholder="https://..."
              />
            </div>
          </div>
          <Button type="submit" disabled={popupSaving || popupLoading}>
            {popupSaving ? 'Đang lưu…' : popupLoading ? 'Đang tải…' : 'Lưu popup Dashboard'}
          </Button>
        </form>

        <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-base font-semibold text-slate-900">Thông báo cũ</p>
            <p className="text-sm text-slate-600">Gửi thông báo vào lịch sử web và Telegram bot như trước.</p>
          </div>
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
    </div>
  );
}

