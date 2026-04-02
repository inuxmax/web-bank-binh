'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  enabled: boolean;
  title: string;
  body: string;
  primaryLabel?: string;
  primaryUrl?: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  updatedAt?: number;
};

const HIDE_FOR_MS = 2 * 60 * 60 * 1000;

export function DashboardAnnouncementPopup(props: Props) {
  const [open, setOpen] = useState(false);

  const storageKey = useMemo(() => {
    const stamp = Number(props.updatedAt || 0);
    return `dashboard_announcement_popup_hidden_until_${stamp}`;
  }, [props.updatedAt]);

  useEffect(() => {
    if (!props.enabled) return;
    const hasContent = props.title.trim() || props.body.trim();
    if (!hasContent) return;
    const hiddenUntil = Number(window.localStorage.getItem(storageKey) || 0);
    if (hiddenUntil > Date.now()) return;
    const timer = window.setTimeout(() => setOpen(true), 250);
    return () => window.clearTimeout(timer);
  }, [props.enabled, props.title, props.body, storageKey]);

  if (!open || !props.enabled) return null;

  function closeForTwoHours() {
    window.localStorage.setItem(storageKey, String(Date.now() + HIDE_FOR_MS));
    setOpen(false);
  }

  function closeNow() {
    setOpen(false);
  }

  const lines = props.body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/55 px-3 py-8 backdrop-blur-[2px] md:items-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white to-slate-50 shadow-[0_40px_120px_-35px_rgba(15,23,42,0.6)]">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 py-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-base">🔔</span>
            Thông Báo
          </p>
          <button
            type="button"
            onClick={closeNow}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-base text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 bg-gradient-to-b from-slate-100/80 to-slate-200/70 p-5 md:p-6">
          <section className="relative overflow-hidden rounded-2xl border border-blue-200/90 bg-white px-5 py-7 md:px-8">
            <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-sky-200/35 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-indigo-200/30 blur-2xl" />
            <h3 className="relative text-center text-3xl font-extrabold tracking-tight text-slate-800">
              {props.title || 'Thông báo hệ thống'}
            </h3>
            {lines.length > 0 ? (
              <div className="relative mt-4 space-y-2.5 text-center">
                {lines.map((line, idx) => (
                  <p
                    key={`${idx}_${line.slice(0, 12)}`}
                    className={idx === 0 ? 'text-xl font-bold text-slate-800' : 'text-base font-semibold text-slate-600'}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
              {props.primaryLabel && props.primaryUrl ? (
                <a
                  href={props.primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 px-7 py-2.5 text-sm font-bold tracking-wide text-white shadow-[0_16px_30px_-14px_rgba(14,165,233,0.9)] transition hover:scale-[1.02] hover:brightness-110"
                >
                  {props.primaryLabel}
                </a>
              ) : null}
              {props.secondaryLabel && props.secondaryUrl ? (
                <a
                  href={props.secondaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-7 py-2.5 text-sm font-bold tracking-wide text-white shadow-[0_16px_30px_-14px_rgba(244,63,94,0.9)] transition hover:scale-[1.02] hover:brightness-110"
                >
                  {props.secondaryLabel}
                </a>
              ) : null}
            </div>
          </section>
        </div>
        <div className="flex justify-end border-t border-slate-200/90 bg-white/90 px-5 py-3.5">
          <button
            type="button"
            onClick={closeForTwoHours}
            className="rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_-14px_rgba(244,63,94,0.95)] transition hover:scale-[1.01] hover:brightness-110"
          >
            Không hiển thị lại trong 2 giờ
          </button>
        </div>
      </div>
    </div>
  );
}
