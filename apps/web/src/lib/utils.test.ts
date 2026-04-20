import { describe, expect, it } from 'vitest';
import { cn, formatCurrency, formatPercent, initialsOf } from './utils';

describe('cn', () => {
  it('concatenates class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('dedupes conflicting tailwind classes, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('formatCurrency', () => {
  it('uses USD by default', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });
});

describe('formatPercent', () => {
  it('prefixes positive percents with +', () => {
    expect(formatPercent(0.1234)).toBe('+12.34%');
  });
  it('leaves negative percents as-is', () => {
    expect(formatPercent(-0.05)).toBe('-5.00%');
  });
});

describe('initialsOf', () => {
  it('uses first letters of two name parts', () => {
    expect(initialsOf('Darshan Patil')).toBe('DP');
  });
  it('falls back to email locals', () => {
    expect(initialsOf('darshan.patil@example.com')).toBe('DP');
  });
  it('returns U for empty input', () => {
    expect(initialsOf(null)).toBe('U');
  });
});
