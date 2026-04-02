'use client';

import { useEffect } from 'react';

export function MouseGlowEffect() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !desktopPointer) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--mouse-x', `${e.clientX}px`);
        root.style.setProperty('--mouse-y', `${e.clientY}px`);
      });
    };
    const onDown = () => root.classList.add('mouse-pressed');
    const onUp = () => root.classList.remove('mouse-pressed');

    root.classList.add('mouse-glow-enabled');
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('blur', onUp);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      root.classList.remove('mouse-glow-enabled');
      root.classList.remove('mouse-pressed');
      root.style.removeProperty('--mouse-x');
      root.style.removeProperty('--mouse-y');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, []);

  return (
    <>
      <div className="mouse-glow-overlay" aria-hidden />
      <div className="mouse-cursor-ring" aria-hidden />
      <div className="mouse-cursor-dot" aria-hidden />
    </>
  );
}
