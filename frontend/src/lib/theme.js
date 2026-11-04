import { useSyncExternalStore } from 'react';

export const MODE_KEY = 'tkb_theme_mode';
export const GLASS_KEY = 'tkb_theme_glass';

export const DEFAULT_THEME = { mode: 'light', glass: true };

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadTheme() {
  const mode = read(MODE_KEY);
  const glass = read(GLASS_KEY);
  return {
    mode: mode === 'dark' || mode === 'light' ? mode : DEFAULT_THEME.mode,
    glass: glass === '0' ? false : glass === '1' ? true : DEFAULT_THEME.glass,
  };
}

export function applyTheme({ mode, glass }) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.dataset.glass = glass ? 'on' : 'off';
  root.style.colorScheme = mode;
}

let current = loadTheme();
const listeners = new Set();

export function getTheme() {
  return current;
}

export function setTheme(patch) {
  const next = { ...current, ...patch };
  if (next.mode === current.mode && next.glass === current.glass) return;
  current = next;
  try {
    localStorage.setItem(MODE_KEY, next.mode);
    localStorage.setItem(GLASS_KEY, next.glass ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyTheme(next);
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  return {
    ...theme,
    setMode: (mode) => setTheme({ mode }),
    toggleGlass: () => setTheme({ glass: !getTheme().glass }),
  };
}

applyTheme(current);
