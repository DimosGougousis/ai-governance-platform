import type { HealthState } from '../types/agent';

export const HEALTH_STATES: Record<HealthState, {
  label: string;
  color: string;
  description: string;
}> = {
  healthy: {
    label: 'Healthy',
    color: '#22c55e',
    description: 'All systems operational, KPIs within thresholds',
  },
  degraded: {
    label: 'Degraded',
    color: '#eab308',
    description: 'Some KPIs in warning, performance below target',
  },
  critical: {
    label: 'Critical',
    color: '#ef4444',
    description: 'SLA breach, circuit breaker triggered, or containment active',
  },
  unknown: {
    label: 'Unknown',
    color: '#6b7280',
    description: 'No recent health check data available',
  },
};
