import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

/**
 * Apply the persisted theme class synchronously — BEFORE React mounts —
 * so users never see a light flash when they prefer dark (or vice versa).
 * The ThemeProvider inside React picks up from here.
 */
(function applyInitialTheme() {
  try {
    const stored = localStorage.getItem('bullfin:theme');
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolved =
      stored === 'light'
        ? 'light'
        : stored === 'system'
          ? prefersDark
            ? 'dark'
            : 'light'
          : 'dark';
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch {
    document.documentElement.classList.add('dark');
  }
})();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
