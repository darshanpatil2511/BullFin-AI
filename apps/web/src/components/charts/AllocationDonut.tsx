import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import {
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipWrapperStyle,
} from './tooltip';

const COLORS = [
  '#10b981',
  '#34d399',
  '#6ee7b7',
  '#f59e0b',
  '#fbbf24',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#94a3b8',
];

export interface AllocationSlice {
  label: string;
  value: number;
}

export function AllocationDonut({ data }: { data: AllocationSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="60%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="var(--color-bg-elevated)"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            cursor={{ fill: 'transparent' }}
            wrapperStyle={tooltipWrapperStyle}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            formatter={(v: number, n: string) => {
              const pct = total > 0 ? (v / total) * 100 : 0;
              return [`${formatCurrency(v)}  ·  ${pct.toFixed(1)}%`, n];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs text-[var(--color-fg-subtle)]">Total value</p>
        <p className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</p>
      </div>
    </div>
  );
}
