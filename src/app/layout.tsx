import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

const sans = GeistSans;
const mono = GeistMono;

export const metadata: Metadata = {
  title: 'Sinpay Console',
  description: 'Quan ly Virtual Account, so du va chi ho Sinpay',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
