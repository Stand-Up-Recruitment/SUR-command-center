import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
} from 'recharts';

interface SparklinePoint {
  label: string;
  value: number;
}

interface MiniSparklineProps {
  data: SparklinePoint[];
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
}

export function MiniSparkline({
  data,
  color = '#3b82f6',
  valuePrefix = '',
  valueSuffix = '',
  height = 56,
}: MiniSparklineProps) {
  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            color: '#0f172a',
          }}
          formatter={(v) => [`${valuePrefix}${Number(v).toLocaleString()}${valueSuffix}`, '']}
          labelFormatter={(l) => l}
          itemStyle={{ color: color }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color.replace('#', '')})`}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
