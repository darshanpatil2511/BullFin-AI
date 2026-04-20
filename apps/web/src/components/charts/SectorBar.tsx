import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import {
  tooltipBarCursor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipWrapperStyle,
} from './tooltip';

interface SectorDatum {
  sector: string;
  value: number;
  weight: number;
}

export function SectorBar({ data }: { data: SectorDatum[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 16, bottom: 28 }}
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
                : `$${v.toFixed(0)}`
            }
            label={{
              value: 'Market value',
              position: 'insideBottom',
              offset: -12,
              style: {
                fill: 'var(--color-fg-muted)',
                fontSize: 11,
                textAnchor: 'middle',
              },
            }}
          />
          <YAxis
            type="category"
            dataKey="sector"
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 11 }}
            width={120}
          />
          <Tooltip
            cursor={tooltipBarCursor}
            wrapperStyle={tooltipWrapperStyle}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(v: number) => [formatCurrency(v), 'Value']}
          />
          <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
