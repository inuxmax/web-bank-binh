'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { Button, Card, FieldLabel, fieldInputClass } from '@/components/ui';

function RegisterPageClient() {
  const router = useRouter();
  const search = useSearchParams();
  const referralFromLink = String(search.get('ref') || '').trim();
  const isReferralLocked = referralFromLink.length > 0;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState(referralFromLink);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!agreedTerms) {
      setErr('Bạn cần đồng ý Chính sách và Điều khoản để tiếp tục.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          fullName,
          phone,
          email,
          referralCode: isReferralLocked ? referralFromLink : referralCode,
          agreedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Lỗi');
        return;
      }
      router.push('/pending');
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
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900">Tạo tài khoản</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            3–32 ký tự (chữ, số, _). Mật khẩu tối thiểu 8 ký tự.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <FieldLabel>Họ và tên</FieldLabel>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={fieldInputClass}
                autoComplete="name"
                required
              />
            </div>
            <div>
              <FieldLabel>Số điện thoại</FieldLabel>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={fieldInputClass}
                autoComplete="tel"
                required
              />
            </div>
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
            <div>
              <FieldLabel>Mã CTV</FieldLabel>
              <input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className={`${fieldInputClass} ${isReferralLocked ? 'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
                placeholder="Nhập mã CTV"
                readOnly={isReferralLocked}
                disabled={isReferralLocked}
              />
              {isReferralLocked ? (
                <p className="mt-1 text-xs text-slate-500">Mã CTV được áp dụng từ link giới thiệu và không thể chỉnh sửa.</p>
              ) : null}
            </div>
            <div>
              <FieldLabel>Tên đăng nhập</FieldLabel>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={fieldInputClass}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <FieldLabel>Mật khẩu</FieldLabel>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldInputClass}
                autoComplete="new-password"
                required
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-1"
                required
              />
              <span>
                Tôi đồng ý{' '}
                <Link href="/chinh-sach-dieu-khoan" className="font-medium text-accent hover:underline">
                  Chính sách và Điều khoản
                </Link>
                .
              </span>
            </label>
            {err ? <p className="text-sm font-medium text-rose-400">{err}</p> : null}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Đang xử lý…' : 'Đăng ký'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Đã có tài khoản?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Đăng nhập
            </Link>
          </p>
        </Card>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageClient />
    </Suspense>
  );
}
