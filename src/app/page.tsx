import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';

export default function HomePage() {
  return (
    <>
      <PublicNav />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-50" aria-hidden />
      <section className="mx-auto max-w-6xl px-4 pb-28 pt-16 sm:px-6 md:pt-24">
        <div className="grid gap-8 lg:grid-cols-5 lg:items-start">
          <div className="max-w-3xl lg:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Dịch vụ Virtual Account</p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-[3.25rem] text-balance">
              Cho thuê và tạo Virtual Account đáp ứng mọi nhu cầu thanh toán
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-8 text-slate-600 text-balance">
              Dễ dàng, tiện lợi, an toàn mọi lúc mọi nơi. Tự động đối soát theo thời gian thực, quản lý giao dịch rõ ràng trên web và Telegram bot.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-app-lg)] bg-accent px-7 text-[15px] font-semibold text-on-accent shadow-glow transition hover:brightness-[1.03]"
              >
                Đăng ký ngay
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-[var(--radius-app-lg)] border border-slate-200 bg-white px-7 text-[15px] font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Đăng nhập
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-6 shadow-card shadow-inner-glow backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Ứng dụng thanh toán</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {[
                  'Thanh toán hóa đơn mua hàng',
                  'Thanh toán học phí',
                  'Thanh toán điện, nước, internet...',
                  'Thanh toán viện phí',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            {
              t: 'Tạo và cho thuê VA nhanh',
              d: 'Khởi tạo VA theo tên riêng, có QR và nội dung CK tùy chỉnh, phù hợp nhiều mục đích thu tiền.',
            },
            {
              t: 'Thanh toán đa nhu cầu',
              d: 'Hỗ trợ các tình huống thu/chi thực tế: mua hàng, học phí, điện nước, internet, viện phí.',
            },
            {
              t: 'An toàn và dễ vận hành',
              d: 'Theo dõi lịch sử giao dịch chi tiết, duyệt rút tiền có xác nhận, thông báo realtime qua bot.',
            },
          ].map((x) => (
            <div
              key={x.t}
              className="group rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-7 shadow-card shadow-inner-glow backdrop-blur-xl transition duration-300 hover:border-accent/25 hover:shadow-card-hover"
            >
              <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">{x.t}</h2>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">{x.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {[
            {
              t: 'Cho shop online',
              d: 'Nhận tiền đơn hàng theo từng VA, đối soát nhanh, giảm nhầm lẫn khi khách chuyển khoản thủ công.',
            },
            {
              t: 'Cho trung tâm giáo dục',
              d: 'Tách học phí theo lớp/học viên, dễ quản lý trạng thái đã thu và lịch sử thanh toán chi tiết.',
            },
            {
              t: 'Cho phòng khám / dịch vụ',
              d: 'Thu viện phí, phí dịch vụ, theo dõi giao dịch realtime và hoàn tiền có kiểm soát khi cần.',
            },
          ].map((x) => (
            <div
              key={x.t}
              className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-white p-6 shadow-inner-glow"
            >
              <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900">{x.t}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{x.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-6 shadow-card shadow-inner-glow">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Quy trình sử dụng</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              {
                step: 'Bước 1',
                t: 'Đăng ký và tạo VA',
                d: 'Tạo tài khoản, nhập thông tin và khởi tạo Virtual Account theo nhu cầu thanh toán.',
              },
              {
                step: 'Bước 2',
                t: 'Nhận tiền tự động',
                d: 'Hệ thống nhận callback IPN, cập nhật số dư và lưu lịch sử giao dịch theo thời gian thực.',
              },
              {
                step: 'Bước 3',
                t: 'Rút tiền linh hoạt',
                d: 'Gửi yêu cầu rút, theo dõi trạng thái xử lý rõ ràng và nhận thông báo qua web, Telegram bot.',
              },
            ].map((x) => (
              <div
                key={x.step}
                className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{x.step}</p>
                <h4 className="mt-2 font-semibold text-slate-900">{x.t}</h4>
                <p className="mt-2 text-sm text-slate-600">{x.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {[
            { k: '24/7', v: 'Theo dõi giao dịch mọi lúc' },
            { k: 'Realtime', v: 'Cập nhật số dư tức thì' },
            { k: 'An toàn', v: 'Bảo mật và lịch sử giao dịch rõ ràng' },
            { k: 'Linh hoạt', v: 'Phí theo user hoặc toàn hệ thống' },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded-[var(--radius-app)] border border-slate-200/90 bg-white px-5 py-4 text-center shadow-inner-glow"
            >
              <p className="font-display text-2xl font-semibold text-slate-900">{x.k}</p>
              <p className="mt-1 text-sm text-slate-600">{x.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-6 shadow-card shadow-inner-glow">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Câu hỏi thường gặp</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              {
                q: 'Có dùng được cho nhiều mục đích thanh toán không?',
                a: 'Có. Bạn có thể dùng cho hóa đơn mua hàng, học phí, điện nước, internet, viện phí và nhiều dịch vụ khác.',
              },
              {
                q: 'Khi có tiền vào VA thì có cập nhật tự động không?',
                a: 'Có. Hệ thống callback IPN cập nhật số dư tự động và lưu lịch sử đầy đủ để đối soát.',
              },
              {
                q: 'Rút tiền có an toàn không?',
                a: 'Có. Luồng rút có bước xác nhận, ghi log lịch sử và thông báo kết quả rõ ràng.',
              },
              {
                q: 'Có hỗ trợ Telegram bot không?',
                a: 'Có. Người dùng có thể nhận thông báo trạng thái giao dịch qua bot Telegram khi đã liên kết.',
              },
            ].map((x) => (
              <div key={x.q} className="rounded-[var(--radius-app)] border border-slate-200 bg-white px-4 py-4">
                <h4 className="font-semibold text-slate-900">{x.q}</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">{x.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-[var(--radius-app-lg)] border border-accent/20 bg-accent/10 px-6 py-8 text-center shadow-inner-glow">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
            Sẵn sàng triển khai thanh toán bằng Virtual Account?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Bắt đầu ngay để tạo VA, theo dõi tiền về realtime và vận hành thanh toán dễ dàng cho doanh nghiệp của bạn.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-app)] bg-accent px-6 text-sm font-semibold text-on-accent shadow-glow transition hover:brightness-[1.03]"
            >
              Tạo tài khoản
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-[var(--radius-app)] border border-slate-200 bg-white px-6 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Đăng nhập hệ thống
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
