'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button, Card, FieldLabel, fieldInputClass } from '@/components/ui';

export default function LoginPage() {
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Lỗi');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PublicNav />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-40" aria-hidden />
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Card padding="lg" className="mx-auto shadow-card-hover">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent/90">Tài khoản</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">Đăng nhập</h1>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <FieldLabel>Tên đăng nhập</FieldLabel>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={fieldInputClass}
                autoComplete="username"
              />
            </div>
            <div>
              <FieldLabel>Mật khẩu</FieldLabel>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldInputClass}
                autoComplete="current-password"
              />
            </div>
            <div className="-mt-1 text-right">
              <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            {err ? <p className="text-sm font-medium text-rose-400">{err}</p> : null}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Đang xử lý…' : 'Đăng nhập'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Đăng ký
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}
