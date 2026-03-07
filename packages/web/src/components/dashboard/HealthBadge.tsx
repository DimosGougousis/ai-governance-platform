'use client';

import { clsx } from 'clsx';

const HEALTH_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  healthy: { color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
  degraded: { color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  critical: { color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
  unknown: { color: 'text-gray-500', bg: 'bg-gray-100', dot: 'bg-gray-400' },
};

export function HealthBadge({ state }: { state: string }) {
  const config = HEALTH_CONFIG[state] || HEALTH_CONFIG.unknown;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', config.color, config.bg)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)}></span>
      {state}
    </span>
  );
}
