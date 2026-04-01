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
  const [code, setCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch(requires2fa ? '/api/auth/login/2fa' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requires2fa ? { username, password, code } : { username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Lỗi');
        return;
      }
      if (data.requires2fa) {
        setRequires2fa(true);
        setInfo(String(data.message || 'Đã gửi mã 2FA qua email.'));
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
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">
            {requires2fa ? 'Xác thực 2FA' : 'Đăng nhập'}
          </h1>
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
            {requires2fa ? (
              <div>
                <FieldLabel>Mã 2FA (gửi qua email)</FieldLabel>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Nhập mã 6 số"
                />
              </div>
            ) : null}
            <div className="-mt-1 text-right">
              <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            {info ? <p className="text-sm font-medium text-emerald-500">{info}</p> : null}
            {err ? <p className="text-sm font-medium text-rose-400">{err}</p> : null}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Đang xử lý…' : requires2fa ? 'Xác thực & đăng nhập' : 'Đăng nhập'}
            </Button>
            {requires2fa ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setRequires2fa(false);
                  setCode('');
                  setInfo('');
                }}
              >
                Quay lại bước mật khẩu
              </Button>
            ) : null}
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
