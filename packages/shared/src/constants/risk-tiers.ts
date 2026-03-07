import type { RiskTier } from '../types/agent';

export const RISK_TIERS: Record<RiskTier, { label: string; description: string; color: string }> = {
  minimal: {
    label: 'Minimal Risk',
    description: 'AI systems posing minimal risk (e.g., spam filters)',
    color: '#22c55e',
  },
  limited: {
    label: 'Limited Risk',
    description: 'AI systems with transparency obligations (e.g., chatbots)',
    color: '#eab308',
  },
  high: {
    label: 'High Risk',
    description: 'AI systems subject to strict obligations (EU AI Act Annex III)',
    color: '#f97316',
  },
  unacceptable: {
    label: 'Unacceptable Risk',
    description: 'AI systems that are prohibited (social scoring, real-time biometrics)',
    color: '#ef4444',
  },
};
