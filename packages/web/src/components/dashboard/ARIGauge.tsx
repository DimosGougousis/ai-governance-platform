'use client';

interface ARIGaugeProps {
  score: number; // 0.00 - 1.00
  size?: 'sm' | 'md' | 'lg';
}

function getARIColor(score: number): string {
  if (score <= 0.25) return '#22c55e'; // green
  if (score <= 0.50) return '#eab308'; // amber
  if (score <= 0.75) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getARILabel(score: number): string {
  if (score <= 0.25) return 'Basic';
  if (score <= 0.50) return 'Semi-Autonomous';
  if (score <= 0.75) return 'Highly Autonomous';
  return 'Fully Autonomous';
}

const SIZES = { sm: 80, md: 120, lg: 160 };

export function ARIGauge({ score, size = 'md' }: ARIGaugeProps) {
  const dim = SIZES[size];
  const radius = (dim - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score * circumference;
  const color = getARIColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth="8"
        />
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          className="transition-all duration-700"
        />
        <text x={dim / 2} y={dim / 2} textAnchor="middle" dominantBaseline="central"
          className="text-lg font-bold fill-gray-900" fontSize={dim / 5}>
          {score.toFixed(2)}
        </text>
      </svg>
      <span className="text-xs font-medium" style={{ color }}>{getARILabel(score)}</span>
    </div>
  );
}
