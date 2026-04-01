import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';

export default function PolicyTermsPage() {
  return (
    <>
      <PublicNav />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-45" aria-hidden />
      <section className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:px-6 md:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          Chính sách vận hành
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Chính sách và Điều khoản sử dụng
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Tài liệu này quy định trách nhiệm và phạm vi sử dụng dịch vụ Virtual Account. Khi sử dụng
          hệ thống, bạn đồng ý tuân thủ toàn bộ điều khoản bên dưới.
        </p>

        <div className="mt-8 space-y-4">
          <article className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5 shadow-inner-glow">
            <h2 className="font-semibold text-slate-900">1) Phạm vi sử dụng dịch vụ</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Chỉ sử dụng cho mục đích thanh toán online hợp pháp.</li>
              <li>Hỗ trợ nhận tiền và quản lý giao dịch qua Virtual Account.</li>
              <li>Không cam kết dùng cho hoạt động ngoài phạm vi pháp luật Việt Nam cho phép.</li>
            </ul>
          </article>

          <article className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5 shadow-inner-glow">
            <h2 className="font-semibold text-slate-900">2) Hành vi bị nghiêm cấm</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Nghiêm cấm mọi hành vi lừa đảo, chiếm đoạt tài sản, rửa tiền, tài trợ khủng bố.</li>
              <li>Nghiêm cấm sử dụng nền tảng để kinh doanh hàng hóa/dịch vụ vi phạm pháp luật.</li>
              <li>Nghiêm cấm giả mạo thông tin, tạo giao dịch khống hoặc can thiệp trái phép hệ thống.</li>
            </ul>
          </article>

          <article className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5 shadow-inner-glow">
            <h2 className="font-semibold text-slate-900">3) Lưu trữ và giám sát dữ liệu</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Hệ thống có ghi nhận lịch sử truy cập, lịch sử đăng nhập và lịch sử giao dịch.</li>
              <li>
                Dữ liệu log có thể bao gồm thời gian, IP, thiết bị, thao tác và thông tin giao dịch liên
                quan để phục vụ an ninh hệ thống.
              </li>
              <li>
                Khi có yêu cầu hợp lệ từ cơ quan chức năng, đơn vị vận hành có quyền cung cấp dữ liệu
                theo quy định pháp luật.
              </li>
            </ul>
          </article>

          <article className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5 shadow-inner-glow">
            <h2 className="font-semibold text-slate-900">4) Tài khoản và bảo mật</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Người dùng chịu trách nhiệm bảo mật tài khoản, mật khẩu và mã xác thực (nếu có).</li>
              <li>Mọi thao tác phát sinh từ tài khoản được xem là do chủ tài khoản thực hiện.</li>
              <li>
                Nếu phát hiện truy cập bất thường, người dùng cần đổi mật khẩu ngay và thông báo để được
                hỗ trợ.
              </li>
            </ul>
          </article>

          <article className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5 shadow-inner-glow">
            <h2 className="font-semibold text-slate-900">5) Xử lý vi phạm</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Đơn vị vận hành có quyền tạm khóa hoặc chấm dứt dịch vụ đối với tài khoản vi phạm.</li>
              <li>
                Nếu phát hiện giao dịch có dấu hiệu lừa đảo hoặc vi phạm pháp luật, hệ thống có quyền
                giữ lại toàn bộ số tiền liên quan và tạm ngưng quyền rút.
              </li>
              <li>
                Người dùng phải phối hợp xác minh giao dịch theo yêu cầu, bao gồm nhưng không giới hạn:
                video chuyển khoản, video nhận tiền, bằng chứng giao dịch và tài liệu liên quan.
              </li>
              <li>
                Chỉ khi kết luận giao dịch không vi phạm, hệ thống mới xem xét mở lại quyền rút theo quy
                trình kiểm soát nội bộ.
              </li>
              <li>Có quyền phối hợp cơ quan chức năng trong điều tra khi cần thiết.</li>
            </ul>
          </article>

          <article className="rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-5 shadow-inner-glow">
            <h2 className="font-semibold text-slate-900">6) Điều khoản bổ sung</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Biểu phí và giới hạn giao dịch có thể thay đổi theo từng thời điểm vận hành.</li>
              <li>
                Việc tiếp tục sử dụng hệ thống sau khi cập nhật chính sách đồng nghĩa với việc chấp nhận
                điều khoản mới.
              </li>
              <li>
                Trong trường hợp có tranh chấp, các bên ưu tiên thương lượng; nếu không đạt, xử lý theo
                pháp luật hiện hành.
              </li>
            </ul>
          </article>
        </div>

        <div className="mt-8 rounded-[var(--radius-app)] border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-slate-700">
          Cần hỗ trợ thêm? Vui lòng liên hệ bộ phận vận hành qua kênh hỗ trợ chính thức của hệ thống.
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← Quay lại trang chủ
          </Link>
        </div>
      </section>
    </>
  );
}

