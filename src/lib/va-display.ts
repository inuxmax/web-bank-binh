/** Dùng được từ Client Components — không import Node/fs */

const VA_BANK_DISPLAY: Record<string, string> = {
  ACB: 'Ngan Hang TMCP A Chau',
  BIDV: 'Ngan Hang Dau Tu & Phat Trien',
  KLB: 'Ngan Hang TMCP Kien Long',
  MB: 'Ngan Hang TMCP Quan Doi',
  MSB: 'Ngan Hang TMCP Hang Hai Viet Nam',
  STB: 'Ngan Hang TMCP Sai Gon Thuong Tin',
  TCB: 'Ngan Hang TMCP Ky Thuong Viet Nam',
  TPB: 'Ngan Hang TMCP Tien Phong',
  VCB: 'Ngan Hang TMCP Ngoai Thuong Viet Nam',
  VPB: 'Ngan Hang TMCP Viet Nam Thinh Vuong',
};

export function displayVaBankClient(decoded: Record<string, string | undefined> | null, bankCode?: string) {
  const code = String(decoded?.vaBank || bankCode || '').trim().toUpperCase();
  if (!code) return '';
  return VA_BANK_DISPLAY[code] || code;
}

export function buildSepayQrUrlClient(opts: {
  acc?: string;
  bank?: string;
  amount?: string | number | null;
  des?: string;
  template?: string;
}) {
  const base = 'https://qr.sepay.vn/img';
  const params = new URLSearchParams();
  if (opts.acc) params.set('acc', String(opts.acc).trim());
  if (opts.bank) params.set('bank', String(opts.bank).trim());
  if (
    opts.amount !== undefined &&
    opts.amount !== null &&
    String(opts.amount).trim() !== '' &&
    Number(opts.amount) > 0
  ) {
    params.set('amount', String(Number(opts.amount)));
  }
  if (opts.des) params.set('des', String(opts.des).trim());
  params.set('template', opts.template || 'qronly');
  return `${base}?${params.toString()}`;
}

export function formatDateTimeVNClient(ts: string | number) {
  const n = Number(ts) || 0;
  if (!n) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(n));
}
