'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button, Card, FieldLabel, fieldInputClass } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setLoadingRequest(true);
    try {
      const res = await fetch('/api/auth/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(String(data.error || 'Không gửi được mã'));
        return;
      }
      setMsg('Nếu email tồn tại, hệ thống đã gửi mã xác nhận khôi phục.');
    } finally {
      setLoadingRequest(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setLoadingReset(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(String(data.error || 'Không đặt lại được mật khẩu'));
        return;
      }
      setMsg('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.');
      setCode('');
      setNewPassword('');
    } finally {
      setLoadingReset(false);
    }
  }

  return (
    <>
      <PublicNav />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-40" aria-hidden />
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card padding="lg" className="mx-auto shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/90">Tài khoản</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">Khôi phục mật khẩu</h1>
          <p className="mt-2 text-sm text-slate-500">Nhập email, nhận mã xác nhận và đặt mật khẩu mới.</p>

          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldInputClass}
                autoComplete="email"
                required
              />
            </div>
            <Button type="submit" disabled={loadingRequest} className="w-full">
              {loadingRequest ? 'Đang gửi…' : 'Gửi mã xác nhận'}
            </Button>
          </form>

          <form onSubmit={resetPassword} className="mt-6 space-y-4">
            <div>
              <FieldLabel>Mã xác nhận (6 số)</FieldLabel>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                className={fieldInputClass}
                required
              />
            </div>
            <div>
              <FieldLabel>Mật khẩu mới</FieldLabel>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={fieldInputClass}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" disabled={loadingReset} className="w-full">
              {loadingReset ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}
            </Button>
          </form>

          {err ? <p className="mt-4 text-sm font-medium text-rose-500">{err}</p> : null}
          {msg ? <p className="mt-4 text-sm font-medium text-emerald-600">{msg}</p> : null}
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-accent hover:underline">
              Quay lại đăng nhập
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}
