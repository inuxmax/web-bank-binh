'use client';

import { useMemo, useState } from 'react';
import { Button } from './button';
import { fieldInputClass } from './field';

type PopupKind = 'alert' | 'confirm' | 'prompt';

type PopupState = {
  kind: PopupKind;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  placeholder: string;
  value: string;
  resolve: (value: string | boolean | null) => void;
};

type PromptOptions = {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type AlertOptions = {
  title?: string;
  message: string;
  confirmText?: string;
};

export function useAppPopup() {
  const [popup, setPopup] = useState<PopupState | null>(null);

  function closeWith(value: string | boolean | null) {
    if (!popup) return;
    const resolver = popup.resolve;
    setPopup(null);
    resolver(value);
  }

  function alert(options: string | AlertOptions): Promise<void> {
    const cfg =
      typeof options === 'string'
        ? ({ message: options } as AlertOptions)
        : options;
    return new Promise<void>((resolve) => {
      setPopup({
        kind: 'alert',
        title: cfg.title || 'Thông báo',
        message: cfg.message,
        confirmText: cfg.confirmText || 'OK',
        cancelText: '',
        placeholder: '',
        value: '',
        resolve: () => resolve(),
      });
    });
  }

  function confirm(options: string | ConfirmOptions): Promise<boolean> {
    const cfg =
      typeof options === 'string'
        ? ({ message: options } as ConfirmOptions)
        : options;
    return new Promise<boolean>((resolve) => {
      setPopup({
        kind: 'confirm',
        title: cfg.title || 'Xác nhận',
        message: cfg.message,
        confirmText: cfg.confirmText || 'Đồng ý',
        cancelText: cfg.cancelText || 'Hủy',
        placeholder: '',
        value: '',
        resolve: (v) => resolve(v === true),
      });
    });
  }

  function prompt(options: string | PromptOptions): Promise<string | null> {
    const cfg =
      typeof options === 'string'
        ? ({ message: options } as PromptOptions)
        : options;
    return new Promise<string | null>((resolve) => {
      setPopup({
        kind: 'prompt',
        title: cfg.title || 'Nhập thông tin',
        message: cfg.message,
        confirmText: cfg.confirmText || 'OK',
        cancelText: cfg.cancelText || 'Hủy',
        placeholder: cfg.placeholder || '',
        value: cfg.defaultValue || '',
        resolve: (v) => resolve(typeof v === 'string' ? v : null),
      });
    });
  }

  const PopupHost = useMemo(
    () =>
      function PopupHostInner() {
        if (!popup) return null;
        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Đóng"
              onClick={() => closeWith(null)}
            />
            <div className="relative z-10 w-full max-w-md rounded-[var(--radius-app-lg)] border border-slate-200/90 bg-surface-1 p-4 shadow-xl">
              <h3 className="font-display text-lg font-semibold text-slate-900">{popup.title}</h3>
              <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{popup.message}</p>
              {popup.kind === 'prompt' ? (
                <input
                  value={popup.value}
                  onChange={(e) => setPopup((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                  placeholder={popup.placeholder}
                  className={`${fieldInputClass} mt-3`}
                  autoFocus
                />
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                {popup.kind !== 'alert' ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => closeWith(null)}>
                    {popup.cancelText}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (popup.kind === 'confirm') closeWith(true);
                    else if (popup.kind === 'prompt') closeWith(popup.value);
                    else closeWith(true);
                  }}
                >
                  {popup.confirmText}
                </Button>
              </div>
            </div>
          </div>
        );
      },
    [popup],
  );

  return { alert, confirm, prompt, PopupHost };
}

