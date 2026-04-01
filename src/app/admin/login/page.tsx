'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, FieldLabel, fieldInputClass } from '@/components/ui';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Đăng nhập thất bại');
        return;
      }
      router.push('/admin');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-50" aria-hidden />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 sm:px-6">
        <Link
          href="/"
          className="mb-10 flex items-center gap-2 font-display text-base font-semibold tracking-tight text-slate-900"
        >
          <span className="text-slate-500 transition hover:text-accent">←</span> Sinpay Console
        </Link>
        <Card padding="lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/90">Bảo mật</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">Quản trị</h1>
          <p className="mt-2 text-sm text-slate-500">
            Đăng nhập bằng tài khoản user đã được cấp quyền admin.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <FieldLabel>Tài khoản</FieldLabel>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={fieldInputClass}
                autoComplete="username"
                placeholder="Tên đăng nhập"
                required
              />
            </div>
            <div>
              <FieldLabel>Mật khẩu</FieldLabel>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldInputClass}
                placeholder="••••••••"
                required
              />
            </div>
            {err ? <p className="text-sm font-medium text-rose-400">{err}</p> : null}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Đang xử lý…' : 'Đăng nhập'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
