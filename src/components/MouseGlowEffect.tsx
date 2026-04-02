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

    root.classList.add('mouse-glow-enabled');
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      root.classList.remove('mouse-glow-enabled');
      root.style.removeProperty('--mouse-x');
      root.style.removeProperty('--mouse-y');
      window.removeEventListener('mousemove', onMove);
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
