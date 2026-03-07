import type { AuthorityLevel } from '../types/governance';

export const AUTHORITY_LEVELS: Record<AuthorityLevel, {
  label: string;
  description: string;
  confidenceThreshold: number;
  monetaryLimit: number | null;
  humanRequired: boolean;
}> = {
  A1: {
    label: 'Full Autonomy',
    description: 'Agent can act independently within defined scope',
    confidenceThreshold: 0.95,
    monetaryLimit: 100,
    humanRequired: false,
  },
  A2: {
    label: 'Supervised Autonomy',
    description: 'Agent acts but human is notified',
    confidenceThreshold: 0.85,
    monetaryLimit: 1000,
    humanRequired: false,
  },
  A3: {
    label: 'Human-Assisted',
    description: 'Agent recommends, human approves',
    confidenceThreshold: 0.70,
    monetaryLimit: 10000,
    humanRequired: true,
  },
  A4: {
    label: 'Human-Led',
    description: 'Human decides, agent assists',
    confidenceThreshold: 0.0,
    monetaryLimit: null,
    humanRequired: true,
  },
  A5: {
    label: 'Prohibited',
    description: 'Agent must not act in this domain',
    confidenceThreshold: 1.0,
    monetaryLimit: 0,
    humanRequired: true,
  },
};
