import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = '/icon.svg';
  url.search = '';
  return NextResponse.redirect(url, 307);
}
