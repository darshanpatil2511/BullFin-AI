import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  MessageSquare,
  FileText,
  HelpCircle,
  LineChart,
  Settings as SettingsIcon,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

const NAV: Array<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/portfolios', label: 'Portfolios', icon: Briefcase },
  { to: '/app/advisor', label: 'AI Advisor', icon: MessageSquare },
  { to: '/app/analyze', label: 'Analyze', icon: BarChart3 },
  { to: '/app/forecast', label: 'Forecast', icon: LineChart },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/help', label: 'Help', icon: HelpCircle },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
];

interface SidebarContentProps {
  /** Invoked when the user picks a destination — lets the mobile drawer close itself. */
  onNavigate?: () => void;
}

/**
 * Rendered both by the fixed desktop sidebar and the mobile drawer, so the
 * nav items stay in a single source of truth.
 */
export function SidebarContent({ onNavigate }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]'
                  : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)]',
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-6 lg:flex">
      <SidebarContent />
    </aside>
  );
}
