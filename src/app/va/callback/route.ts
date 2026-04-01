import { GET as ipnGet, POST as ipnPost } from '@/app/api/ipn/va/route';

export const runtime = 'nodejs';

/** Alias callback để tương thích cấu hình cũ từ Hpay. */
export async function GET(req: Request) {
  return ipnGet(req);
}

export async function POST(req: Request) {
  return ipnPost(req);
}

