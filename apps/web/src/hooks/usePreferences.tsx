import * as React from 'react';

export interface Preferences {
  /** Ticker used as the default benchmark on the Dashboard + reports. */
  defaultBenchmark: string;
  /** When true, large numbers format compactly ($1.2k instead of $1,234). */
  compactNumbers: boolean;
}

const STORAGE_KEY = 'bullfin:prefs';

const DEFAULT: Preferences = {
  defaultBenchmark: 'SPY',
  compactNumbers: false,
};

function read(): Preferences {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

interface PreferencesContextValue {
  preferences: Preferences;
  updatePreferences: (partial: Partial<Preferences>) => void;
  resetPreferences: () => void;
}

const PreferencesContext = React.createContext<PreferencesContextValue | null>(null);

/**
 * Provider — backs a single source-of-truth for preferences so any change
 * made in Settings re-renders every consumer (KPI cards, charts, queries)
 * without a full page reload.
 */
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] = React.useState<Preferences>(read);

  const updatePreferences = React.useCallback((partial: Partial<Preferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetPreferences = React.useCallback(() => {
    setPreferencesState(DEFAULT);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<PreferencesContextValue>(
    () => ({ preferences, updatePreferences, resetPreferences }),
    [preferences, updatePreferences, resetPreferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = React.useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}
