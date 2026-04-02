'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sinpay_theme_mode';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('theme-dark', isDark);
  root.classList.toggle('theme-light', !isDark);
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3c.08 0 .15 0 .23.01A7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ThemeModeFab() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('light');
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = String(window.localStorage.getItem(STORAGE_KEY) || '').trim().toLowerCase();
    const initial: ThemeMode = saved === 'dark' || saved === 'system' ? (saved as ThemeMode) : 'light';
    setMode(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!open) return;
      const node = popRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handle = () => {
      if (mode === 'system') applyTheme('system');
    };
    media.addEventListener('change', handle);
    return () => media.removeEventListener('change', handle);
  }, [mode]);

  const activeLabel = useMemo(() => {
    if (mode === 'dark') return 'Tối';
    if (mode === 'system') return 'Hệ thống';
    return 'Sáng';
  }, [mode]);

  function choose(nextMode: ThemeMode) {
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(nextMode);
    setOpen(false);
  }

  return (
    <div ref={popRef} className="fixed bottom-5 right-5 z-[9999]">
      {open ? (
        <div className="mb-2 w-52 rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1/95 p-2 shadow-card backdrop-blur-md">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Giao diện</p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => choose('light')}
              className={`flex w-full items-center gap-2 rounded-[var(--radius-app)] px-3 py-2 text-sm transition ${
                mode === 'light' ? 'bg-accent text-on-accent' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SunIcon />
              Chế độ sáng
            </button>
            <button
              type="button"
              onClick={() => choose('dark')}
              className={`flex w-full items-center gap-2 rounded-[var(--radius-app)] px-3 py-2 text-sm transition ${
                mode === 'dark' ? 'bg-accent text-on-accent' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MoonIcon />
              Chế độ tối
            </button>
            <button
              type="button"
              onClick={() => choose('system')}
              className={`flex w-full items-center gap-2 rounded-[var(--radius-app)] px-3 py-2 text-sm transition ${
                mode === 'system' ? 'bg-accent text-on-accent' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="inline-block h-4 w-4 rounded-full border border-current" />
              Theo hệ thống
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chuyển chế độ sáng/tối"
        className="group flex items-center gap-2 rounded-full border border-slate-200/90 bg-surface-1/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow-card backdrop-blur-md transition hover:border-accent/35 hover:text-slate-900"
      >
        <MoonIcon />
        <span>{activeLabel}</span>
      </button>
    </div>
  );
}
