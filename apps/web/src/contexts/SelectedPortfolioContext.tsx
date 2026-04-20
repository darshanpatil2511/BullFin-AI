import * as React from 'react';

/**
 * Tracks which portfolio the user last picked, so that jumping between
 * Analyze / Forecast / Reports / Advisor keeps the selection sticky instead
 * of defaulting back to the first portfolio every time. Persisted in
 * localStorage so it survives full reloads too.
 *
 * Pages should still honor a `?portfolio=` URL param (deep-links from the
 * portfolio detail page) and write that back here so the context stays in
 * sync with what the user is actually looking at.
 */

interface SelectedPortfolioValue {
  selectedId: string | undefined;
  setSelectedId: (id: string | undefined) => void;
}

const STORAGE_KEY = 'bullfin:selected-portfolio';

const SelectedPortfolioContext = React.createContext<SelectedPortfolioValue | null>(null);

export function SelectedPortfolioProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedIdState] = React.useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      return localStorage.getItem(STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });

  const setSelectedId = React.useCallback((id: string | undefined) => {
    setSelectedIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable — in-memory state still works */
    }
  }, []);

  const value = React.useMemo<SelectedPortfolioValue>(
    () => ({ selectedId, setSelectedId }),
    [selectedId, setSelectedId],
  );

  return (
    <SelectedPortfolioContext.Provider value={value}>
      {children}
    </SelectedPortfolioContext.Provider>
  );
}

export function useSelectedPortfolio(): SelectedPortfolioValue {
  const ctx = React.useContext(SelectedPortfolioContext);
  if (!ctx) {
    throw new Error('useSelectedPortfolio must be used inside <SelectedPortfolioProvider>');
  }
  return ctx;
}
