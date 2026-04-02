import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { ThemeModeFab } from '@/components/ThemeModeFab';
import { MouseGlowEffect } from '@/components/MouseGlowEffect';

const sans = GeistSans;
const mono = GeistMono;

export const metadata: Metadata = {
  title: 'Sinpay Console',
  description: 'Quan ly Virtual Account, so du va chi ho Sinpay',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='sinpay_theme_mode';var m=(localStorage.getItem(k)||'light').toLowerCase();var d=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('theme-dark',d);document.documentElement.classList.toggle('theme-light',!d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans" suppressHydrationWarning>
        <MouseGlowEffect />
        {children}
        <ThemeModeFab />
      </body>
    </html>
  );
}
