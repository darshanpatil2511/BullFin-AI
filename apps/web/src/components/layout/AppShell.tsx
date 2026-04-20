import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

/**
 * App shell — sidebar on the left, main column on the right.
 *
 * Crucially the outer container is `h-screen` (not `min-h-screen`) and the
 * main column is `min-h-0` so descendant panels can size themselves to fit
 * the viewport. Pages opt in to scroll via `overflow-y-auto` on their
 * content wrapper (see DashboardPage, PortfoliosPage, etc). The chat page
 * uses its own internal scroll so messages scroll inside a fixed panel
 * instead of pushing the whole page down.
 */
export function AppShell() {
  return (
    <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <Sidebar />
      <main className="flex flex-1 flex-col min-w-0 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
