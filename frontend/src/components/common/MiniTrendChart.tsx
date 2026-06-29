'use client';

interface Props {
  values: number[];
  height?: number;
  stroke?: string;
}

export default function MiniTrendChart({ values, height = 56, stroke = '#A2A29B' }: Props) {
  if (values.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center rounded-card bg-surface-base/60 text-micro text-ink-muted">
        Sin suficientes datos
      </div>
    );
  }

  const width = 180;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible rounded-card bg-surface-base/40">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        points={points.join(' ')}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => {
        const [cx, cy] = point.split(',');
        return <circle key={index} cx={cx} cy={cy} r="2.5" fill="#E9F34A" />;
      })}
    </svg>
  );
}
