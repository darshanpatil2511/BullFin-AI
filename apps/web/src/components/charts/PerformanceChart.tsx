import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  tooltipContentStyle,
  tooltipCrosshair,
  tooltipItemStyle,
  tooltipLabelStyle,
  tooltipWrapperStyle,
} from './tooltip';

interface Point {
  date: string;
  portfolio: number;
  benchmark: number;
}

/** Turn an ISO date (YYYY-MM-DD) into a short "MMM YYYY" tick label. */
function formatDateTick(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function PerformanceChart({ data, benchmark }: { data: Point[]; benchmark: string }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 16, bottom: 28 }}>
          <defs>
            <linearGradient id="gPortfolio" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 11 }}
            tickMargin={8}
            minTickGap={60}
            tickFormatter={formatDateTick}
            label={{
              value: 'Date',
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
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 11 }}
            tickMargin={8}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `${((v - 1) * 100).toFixed(0)}%`}
            label={{
              value: 'Cumulative return',
              angle: -90,
              position: 'insideLeft',
              offset: 0,
              style: {
                fill: 'var(--color-fg-muted)',
                fontSize: 11,
                textAnchor: 'middle',
              },
            }}
          />
          <Tooltip
            cursor={tooltipCrosshair}
            wrapperStyle={tooltipWrapperStyle}
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            labelFormatter={(iso: string) => {
              const d = new Date(iso);
              return Number.isNaN(d.getTime())
                ? iso
                : d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
            }}
            formatter={(v: number, name: string) => [
              `${((v - 1) * 100).toFixed(2)}%`,
              name === 'portfolio' ? 'Portfolio' : benchmark,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--color-fg-muted)' }}
            iconType="circle"
            formatter={(value) => (value === 'portfolio' ? 'Portfolio' : benchmark)}
          />
          <Area
            type="monotone"
            dataKey="portfolio"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gPortfolio)"
          />
          <Area
            type="monotone"
            dataKey="benchmark"
            stroke="#94a3b8"
            strokeWidth={2}
            fill="url(#gBenchmark)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
