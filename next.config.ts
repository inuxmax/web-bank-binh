import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  /**
   * Gói dùng Node builtins — để Next không bundle vào chunk rồi resolve `crypto`/`fs` kiểu browser.
   * Không dùng `resolve.fallback` tùy chỉnh: dễ làm hỏng layer instrumentation + bcryptjs.
   */
  serverExternalPackages: [
    'telegraf',
    'safe-compare',
    'buffer-alloc',
    'bcryptjs',
    'mongoose',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qr.sepay.vn', pathname: '/img' },
    ],
  },
};

export default nextConfig;
