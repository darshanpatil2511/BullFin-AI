import { parse } from 'csv-parse/sync';
import type { HoldingInput } from '@bullfin/shared';
import { ValidationError } from './errors.js';

// Canonical field → accepted header aliases (case-insensitive, trimmed).
const FIELD_ALIASES: Record<keyof HoldingInput, string[]> = {
  symbol: ['symbol', 'ticker', 'stock', 'code'],
  shares: ['shares', 'quantity', 'qty', 'units'],
  purchasePrice: ['purchaseprice', 'price', 'avgcost', 'cost', 'buyprice'],
  purchaseDate: ['purchasedate', 'date', 'buydate'],
  sector: ['sector', 'industry'],
  notes: ['notes', 'note', 'comment'],
};

const REQUIRED_FIELDS = ['symbol', 'shares', 'purchasePrice', 'purchaseDate'] as const;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]/g, '');
}

function findField(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalizeHeader(key))) return row[key];
  }
  return undefined;
}

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  // Accept YYYY-MM-DD, ISO timestamps, and common locale-free forms.
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Parses an in-memory CSV buffer into a list of validated holdings.
 * Throws ValidationError with row-level details on any bad input so the
 * user sees a useful message instead of "Server error".
 */
export function parseHoldingsCsv(buf: Buffer): HoldingInput[] {
  let rows: Record<string, string>[];
  try {
    rows = parse(buf, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    throw new ValidationError('Malformed CSV — could not parse headers or rows.', {
      reason: (err as Error).message,
    });
  }

  if (rows.length === 0) {
    throw new ValidationError('CSV is empty.');
  }
  if (rows.length > 500) {
    throw new ValidationError('CSV has too many rows. Maximum is 500.');
  }

  const holdings: HoldingInput[] = [];
  const issues: Array<{ row: number; field: string; message: string }> = [];

  rows.forEach((raw, i) => {
    const rowNum = i + 2; // accounting for header row in messages

    const symbol = findField(raw, FIELD_ALIASES.symbol)?.trim().toUpperCase();
    const shares = parseFloat(findField(raw, FIELD_ALIASES.shares) ?? '');
    const purchasePrice = parseFloat(findField(raw, FIELD_ALIASES.purchasePrice) ?? '');
    const purchaseDateRaw = findField(raw, FIELD_ALIASES.purchaseDate);
    const purchaseDate = purchaseDateRaw ? normalizeDate(purchaseDateRaw) : null;
    const sector = findField(raw, FIELD_ALIASES.sector)?.trim() || null;
    const notes = findField(raw, FIELD_ALIASES.notes)?.trim() || null;

    if (!symbol || !/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
      issues.push({ row: rowNum, field: 'symbol', message: 'Missing or invalid symbol' });
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      issues.push({ row: rowNum, field: 'shares', message: 'Shares must be a positive number' });
      return;
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      issues.push({
        row: rowNum,
        field: 'purchasePrice',
        message: 'Purchase price must be non-negative',
      });
      return;
    }
    if (!purchaseDate) {
      issues.push({
        row: rowNum,
        field: 'purchaseDate',
        message: 'Missing or unparseable purchase date',
      });
      return;
    }

    holdings.push({ symbol, shares, purchasePrice, purchaseDate, sector, notes });
  });

  if (issues.length) {
    throw new ValidationError(`CSV has ${issues.length} invalid row(s).`, { issues });
  }

  // Sanity — at least one required column must have been recognized.
  if (holdings.length === 0) {
    throw new ValidationError(
      `CSV did not contain any of the required columns: ${REQUIRED_FIELDS.join(', ')}`,
    );
  }

  return holdings;
}
