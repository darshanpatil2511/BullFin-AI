import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { SelectedPortfolioProvider } from '@/contexts/SelectedPortfolioContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { RequireAuth, RedirectIfAuthed } from '@/components/layout/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Code-split pages to keep the landing bundle small.
const LandingPage = lazy(() => import('@/pages/marketing/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/app/DashboardPage'));
const PortfoliosPage = lazy(() => import('@/pages/app/portfolios/PortfoliosPage'));
const PortfolioDetailPage = lazy(() => import('@/pages/app/portfolios/PortfolioDetailPage'));
const AdvisorPage = lazy(() => import('@/pages/app/advisor/AdvisorPage'));
const AnalyzePage = lazy(() => import('@/pages/app/AnalyzePage'));
const ForecastPage = lazy(() => import('@/pages/app/ForecastPage'));
const ReportsPage = lazy(() => import('@/pages/app/ReportsPage'));
const HelpPage = lazy(() => import('@/pages/app/HelpPage'));
const SettingsPage = lazy(() => import('@/pages/app/SettingsPage'));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PreferencesProvider>
        <TooltipProvider delayDuration={200}>
          <AuthProvider>
            <BrowserRouter>
              <Suspense
                fallback={<div aria-hidden className="h-screen w-full bg-[var(--color-bg)]" />}
              >
                <Routes>
                  {/* Public marketing + auth */}
                  <Route path="/" element={<LandingPage />} />
                  <Route
                    path="/login"
                    element={
                      <RedirectIfAuthed>
                        <LoginPage />
                      </RedirectIfAuthed>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <RedirectIfAuthed>
                        <RegisterPage />
                      </RedirectIfAuthed>
                    }
                  />

                  {/* Authenticated app */}
                  <Route
                    path="/app"
                    element={
                      <RequireAuth>
                        <SelectedPortfolioProvider>
                          <AppShell />
                        </SelectedPortfolioProvider>
                      </RequireAuth>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="portfolios" element={<PortfoliosPage />} />
                    <Route path="portfolios/:id" element={<PortfolioDetailPage />} />
                    <Route path="advisor" element={<AdvisorPage />} />
                    <Route path="analyze" element={<AnalyzePage />} />
                    <Route path="forecast" element={<ForecastPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="help" element={<HelpPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <ThemedToaster />
          </AuthProvider>
        </TooltipProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Sonner's built-in theme prop should follow whatever the user picked; we
 * also pipe our CSS vars through toastOptions so success/error accents match.
 */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-fg)',
        },
      }}
    />
  );
}

export default App;
