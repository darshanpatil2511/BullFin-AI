import { describe, expect, it } from 'vitest';
import { parseHoldingsCsv } from '../lib/csv.js';

describe('parseHoldingsCsv', () => {
  it('parses the canonical schema', () => {
    const csv = Buffer.from(
      'symbol,shares,purchasePrice,purchaseDate\nAAPL,10,150,2024-01-02\nMSFT,5,300.5,2024-02-10\n',
    );
    const rows = parseHoldingsCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      symbol: 'AAPL',
      shares: 10,
      purchasePrice: 150,
      purchaseDate: '2024-01-02',
    });
  });

  it('accepts the alternate ticker/quantity/price column names', () => {
    const csv = Buffer.from('ticker,quantity,cost,date\ngoog,3,2800.5,2024-03-01');
    const rows = parseHoldingsCsv(csv);
    expect(rows[0]?.symbol).toBe('GOOG');
    expect(rows[0]?.shares).toBe(3);
    expect(rows[0]?.purchasePrice).toBe(2800.5);
  });

  it('rejects rows with bad data', () => {
    const csv = Buffer.from('symbol,shares,purchasePrice,purchaseDate\n,10,150,2024-01-01');
    expect(() => parseHoldingsCsv(csv)).toThrow(/1 invalid row/);
  });

  it('rejects empty CSVs', () => {
    expect(() => parseHoldingsCsv(Buffer.from('symbol,shares,purchasePrice,purchaseDate\n'))).toThrow(
      /empty/i,
    );
  });

  it('normalizes timestamp dates to YYYY-MM-DD', () => {
    const csv = Buffer.from(
      'symbol,shares,purchasePrice,purchaseDate\nAAPL,1,100,2024-05-15T12:30:00Z',
    );
    const rows = parseHoldingsCsv(csv);
    expect(rows[0]?.purchaseDate).toBe('2024-05-15');
  });
});
