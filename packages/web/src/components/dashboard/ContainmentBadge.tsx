'use client';

import { clsx } from 'clsx';

const LEVEL_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Standard', color: 'text-green-700', bg: 'bg-green-100' },
  1: { label: 'State-Preserving', color: 'text-amber-700', bg: 'bg-amber-100' },
  2: { label: 'Planning Lock', color: 'text-orange-700', bg: 'bg-orange-100' },
  3: { label: 'Tool Restricted', color: 'text-red-700', bg: 'bg-red-100' },
  4: { label: 'Isolated', color: 'text-red-900', bg: 'bg-red-200' },
};

export function ContainmentBadge({ level }: { level: number }) {
  const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[0];
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', config.color, config.bg)}>
      {level > 0 && <span>L{level}</span>}
      {config.label}
    </span>
  );
}
