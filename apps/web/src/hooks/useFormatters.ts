import { formatCurrency as baseFormatCurrency } from '@/lib/utils';
import { usePreferences } from './usePreferences';

/**
 * Currency / number formatters bound to the current user preferences.
 * Components that render large dollar values on KPI cards should use this
 * instead of calling `formatCurrency` directly — it's the one place that
 * honors the "compact numbers" setting.
 */
export function useFormatters() {
  const { preferences } = usePreferences();
  const compact = preferences.compactNumbers;

  return {
    /** Respects the user's compactNumbers preference. */
    formatCurrency: (value: number, currency = 'USD', maximumFractionDigits = 2): string =>
      baseFormatCurrency(value, currency, maximumFractionDigits, { compact }),
  };
}
