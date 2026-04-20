/**
 * Shared Recharts tooltip styling — ensures consistent, high-contrast
 * tooltips across every chart in the app. Import these and spread onto
 * the <Tooltip> element.
 */

export const tooltipContentStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 12,
  color: 'var(--color-fg)',
  boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.5)',
};

export const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--color-fg-muted)',
  fontWeight: 500,
  marginBottom: 6,
};

export const tooltipItemStyle: React.CSSProperties = {
  color: 'var(--color-fg)',
  fontWeight: 500,
};

export const tooltipWrapperStyle: React.CSSProperties = {
  outline: 'none',
  zIndex: 10,
};

export const tooltipCrosshair = {
  stroke: 'var(--color-brand-400)',
  strokeWidth: 1,
  strokeDasharray: '3 3',
} as const;

export const tooltipBarCursor = {
  fill: 'rgba(16, 185, 129, 0.10)',
} as const;
