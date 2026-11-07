'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const order: Theme[] = ['system', 'light', 'dark'];
const icons = { system: Monitor, light: Sun, dark: Moon };

/** Cycles system → light → dark. The head script in layout.tsx applies the saved choice before paint. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') setTheme(t);
  }, []);

  function next() {
    const t = order[(order.indexOf(theme) + 1) % order.length]!;
    setTheme(t);
    try {
      if (t === 'system') localStorage.removeItem('theme');
      else localStorage.setItem('theme', t);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  const Icon = icons[theme];
  return (
    <button
      type='button'
      onClick={next}
      className='grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text cursor-pointer'
      aria-label={`Theme: ${theme}. Switch theme`}
      title={`Theme: ${theme}`}
    >
      <Icon className='h-4 w-4' />
    </button>
  );
}
