import type { ContractType } from '@governance/shared';

/**
 * Normalizes validated contract data into the internal database schema.
 * The normalizer bridges the gap between the external contract format
 * (what tools push) and the internal storage format (Drizzle schema).
 *
 * This is where tool-agnosticism is enforced: the normalizer doesn't
 * care which tool produced the data — it only transforms validated
 * contract payloads into database-ready rows.
 */

export interface NormalizedRecord {
  table: string;
  data: Record<string, unknown>;
  agentId: string;
  contractType: ContractType;
  timestamp: string;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

export function normalizeC2Health(validated: Record<string, unknown>): NormalizedRecord {
  const ts = toDate(validated.timestamp);
  return {
    table: 'health_checks',
    agentId: validated.agentId as string,
    contractType: 'C2',
    timestamp: ts.toISOString(),
    data: {
      agentId: validated.agentId,
      timestamp: ts,
      modelAvailable: validated.modelAvailable,
      toolConnectivity: validated.toolConnectivity,
      latencyP95Ms: validated.latencyP95Ms,
      errorRate5m: String(validated.errorRate5m),
      circuitBreakers: validated.circuitBreakers || {},
    },
  };
}

export function normalizeC4Cost(validated: Record<string, unknown>): NormalizedRecord {
  return {
    table: 'cost_records',
    agentId: validated.agentId as string,
    contractType: 'C4',
    timestamp: new Date().toISOString(),
    data: {
      agentId: validated.agentId,
      period: validated.period,
      monthlyTotal: String(validated.monthlyTotal),
      costPerInteraction: String(validated.costPerInteraction),
      llmTokenCost: String(validated.llmTokenCost),
      toolCallCost: String(validated.toolCallCost),
      infraCost: String(validated.infraCost),
    },
  };
}

export function normalizeC5Drift(validated: Record<string, unknown>): NormalizedRecord {
  const ts = toDate(validated.detectedAt);
  return {
    table: 'drift_results',
    agentId: validated.agentId as string,
    contractType: 'C5',
    timestamp: ts.toISOString(),
    data: {
      agentId: validated.agentId,
      driftType: validated.driftType,
      statisticalTest: validated.statisticalTest,
      score: String(validated.score),
      severity: validated.severity,
      features: validated.features || {},
      detectionMethod: validated.statisticalTest,
      remediationStatus: 'pending',
      timestamp: ts,
    },
  };
}

export function normalizeC6Guardrail(validated: Record<string, unknown>): NormalizedRecord {
  const ts = toDate(validated.timestamp);
  return {
    table: 'guardrail_events',
    agentId: validated.agentId as string,
    contractType: 'C6',
    timestamp: ts.toISOString(),
    data: {
      agentId: validated.agentId,
      timestamp: ts,
      railType: validated.railType,
      action: validated.action,
      triggerReason: validated.triggerReason,
      inputHash: validated.inputHash || null,
    },
  };
}

export function normalizeC7Decision(validated: Record<string, unknown>): NormalizedRecord {
  const ts = toDate(validated.timestamp);
  return {
    table: 'autonomous_decisions',
    agentId: validated.agentId as string,
    contractType: 'C7',
    timestamp: ts.toISOString(),
    data: {
      agentId: validated.agentId,
      decisionType: validated.decisionType,
      authorityLevel: validated.authorityLevel,
      confidenceScore: String(validated.confidenceScore),
      monetaryImpact: validated.monetaryImpact ? String(validated.monetaryImpact) : null,
      reversibility: validated.reversibility === 'full' ? 'reversible'
        : validated.reversibility === 'partial' ? 'partially_reversible'
        : 'irreversible',
      humanInvolvement: 'none',
      timestamp: ts,
    },
  };
}

const NORMALIZERS: Partial<Record<ContractType, (data: Record<string, unknown>) => NormalizedRecord>> = {
  C2: normalizeC2Health,
  C4: normalizeC4Cost,
  C5: normalizeC5Drift,
  C6: normalizeC6Guardrail,
  C7: normalizeC7Decision,
};

/**
 * Normalizes a validated contract payload for database insertion.
 * C1 (Identity) is handled by the agent CRUD routes directly.
 * C3 (Traces) comes via OTLP and is handled by the otlp-receiver.
 */
export function normalize(contractType: ContractType, validated: Record<string, unknown>): NormalizedRecord | null {
  const normalizer = NORMALIZERS[contractType];
  if (!normalizer) return null;
  return normalizer(validated);
}
