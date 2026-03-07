'use client';

import { clsx } from 'clsx';

interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'green' | 'amber' | 'red' | 'neutral';
  subtitle?: string;
}

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-green-50 border-green-200',
  amber: 'bg-amber-50 border-amber-200',
  red: 'bg-red-50 border-red-200',
  neutral: 'bg-gray-50 border-gray-200',
};

const STATUS_DOT: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  neutral: 'bg-gray-400',
};

export function MetricCard({ label, value, unit, status = 'green', subtitle }: MetricCardProps) {
  return (
    <div className={clsx('rounded-xl border p-5 transition-shadow hover:shadow-md', STATUS_COLORS[status])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className={clsx('w-2.5 h-2.5 rounded-full', STATUS_DOT[status])}></span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
