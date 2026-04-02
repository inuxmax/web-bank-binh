'use client';

import { useEffect, useState } from 'react';
import { Button, Card, FieldLabel, PageHeader, fieldInputClass } from '@/components/ui';

type MeUser = {
  id: string;
  username: string;
  webLogin?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  telegramLinked?: boolean;
  telegramUsername?: string;
  balance?: number;
  createdVA?: number;
  twoFactorEnabled?: boolean;
};

export default function ProfilePage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [saving2fa, setSaving2fa] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/me', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.user) {
      setUser(d.user as MeUser);
      setTwoFactorEnabled(Boolean(d.user.twoFactorEnabled));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (newPassword !== confirmPassword) {
      setErr('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    setSavingPassword(true);
    const res = await fetch('/api/me/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const d = await res.json().catch(() => ({}));
    setSavingPassword(false);
    if (!res.ok) {
      setErr(String(d.error || 'Đổi mật khẩu thất bại'));
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMsg('Đã đổi mật khẩu thành công.');
  }

  async function save2fa(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setSaving2fa(true);
    const res = await fetch('/api/me/2fa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: twoFactorEnabled, currentPassword: twoFactorPassword }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving2fa(false);
    if (!res.ok) {
      setErr(String(d.error || 'Lưu 2FA thất bại'));
      return;
    }
    setTwoFactorPassword('');
    setMsg(twoFactorEnabled ? 'Đã bật 2FA bảo vệ đăng nhập.' : 'Đã tắt 2FA.');
    await load();
  }

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Tài khoản" title="Profile" description="Thông tin tài khoản và bảo mật." />
        <p className="text-sm text-slate-500">Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Tài khoản" title="Profile" description="Thông tin tài khoản và bảo mật." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card padding="sm" className="border-sky-200/80 bg-sky-50/60">
          <p className="text-xs text-sky-700">Số dư</p>
          <p className="text-sm font-semibold text-sky-900">{Number(user?.balance || 0).toLocaleString('vi-VN')} đ</p>
        </Card>
        <Card padding="sm" className="border-emerald-200/80 bg-emerald-50/60">
          <p className="text-xs text-emerald-700">Số VA đã tạo</p>
          <p className="text-sm font-semibold text-emerald-900">{Number(user?.createdVA || 0).toLocaleString('vi-VN')}</p>
        </Card>
        <Card padding="sm" className="border-amber-200/80 bg-amber-50/60">
          <p className="text-xs text-amber-700">Trạng thái 2FA</p>
          <p className="text-sm font-semibold text-amber-900">{user?.twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}</p>
        </Card>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">{err}</div>
      ) : null}
      {msg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">{msg}</div>
      ) : null}

      <Card padding="lg" className="border border-slate-200/90 bg-white/95 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Thông tin tài khoản</h3>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">User ID:</span> <span className="font-mono font-semibold text-slate-900">{user?.id || '—'}</span></p>
          <p><span className="text-slate-500">User:</span> <span className="font-medium text-slate-900">{user?.username || '—'}</span></p>
          <p><span className="text-slate-500">Login:</span> <span className="font-medium text-slate-900">{user?.webLogin || '—'}</span></p>
          <p><span className="text-slate-500">Họ tên:</span> <span className="font-medium text-slate-900">{user?.fullName || '—'}</span></p>
          <p><span className="text-slate-500">SĐT:</span> <span className="font-medium text-slate-900">{user?.phone || '—'}</span></p>
          <p><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-900">{user?.email || '—'}</span></p>
          <p>
            <span className="text-slate-500">Telegram:</span>{' '}
            <span className="font-medium">
              {user?.telegramLinked ? `Đã kết nối${user.telegramUsername ? ` (@${user.telegramUsername})` : ''}` : 'Chưa kết nối'}
            </span>
          </p>
          <p><span className="text-slate-500">Số dư:</span> <span className="font-medium">{Number(user?.balance || 0).toLocaleString('vi-VN')} đ</span></p>
          <p><span className="text-slate-500">Số VA đã tạo:</span> <span className="font-medium">{Number(user?.createdVA || 0).toLocaleString('vi-VN')}</span></p>
          <p><span className="text-slate-500">2FA:</span> <span className="font-medium">{user?.twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}</span></p>
        </div>
      </Card>

      <Card padding="lg" className="border border-slate-200/90 bg-white/95 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Đổi mật khẩu</h3>
        <form onSubmit={savePassword} className="grid gap-3 sm:max-w-lg">
          <div>
            <FieldLabel>Mật khẩu hiện tại</FieldLabel>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={fieldInputClass} />
          </div>
          <div>
            <FieldLabel>Mật khẩu mới</FieldLabel>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={fieldInputClass} />
          </div>
          <div>
            <FieldLabel>Nhập lại mật khẩu mới</FieldLabel>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={fieldInputClass} />
          </div>
          <Button type="submit" disabled={savingPassword} className="w-full sm:w-auto">{savingPassword ? 'Đang lưu…' : 'Đổi mật khẩu'}</Button>
        </form>
      </Card>

      <Card padding="lg" className="border border-slate-200/90 bg-white/95 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Bảo mật 2FA (email)</h3>
        <form onSubmit={save2fa} className="grid gap-3 sm:max-w-lg">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={twoFactorEnabled} onChange={(e) => setTwoFactorEnabled(e.target.checked)} />
            Bật 2FA khi đăng nhập
          </label>
          <div>
            <FieldLabel>Xác nhận mật khẩu hiện tại</FieldLabel>
            <input type="password" value={twoFactorPassword} onChange={(e) => setTwoFactorPassword(e.target.value)} className={fieldInputClass} />
          </div>
          <Button type="submit" disabled={saving2fa} className="w-full sm:w-auto">{saving2fa ? 'Đang lưu…' : 'Lưu 2FA'}</Button>
          <p className="text-xs text-slate-500">Khi bật 2FA, sau bước mật khẩu hệ thống sẽ gửi mã OTP qua email để xác thực đăng nhập.</p>
        </form>
      </Card>
    </div>
  );
}
