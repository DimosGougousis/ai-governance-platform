import { z } from 'zod';

// ─── C1: Identity & Registration ───────────────────────────────────────────
export const contractC1Schema = z.object({
  agentName: z.string().min(1).max(255),
  agentType: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
  modelId: z.string().min(1).max(255),
  modelVersion: z.string().min(1).max(50),
  deployEnv: z.enum(['development', 'staging', 'production']),
  riskTier: z.enum(['minimal', 'limited', 'high', 'unacceptable']),
  oversightModel: z.enum(['HITL', 'HOTL', 'HOTA']),
  owner: z.string().min(1).max(255),
  team: z.string().min(1).max(255),
  functions: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  ariScores: z.object({
    autonomy: z.tuple([z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3)]),
    adaptability: z.tuple([z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3)]),
    continuity: z.tuple([z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3)]),
  }).optional(),
  apiRequirements: z.record(z.string(), z.object({
    provider: z.string(),
    protocol: z.enum(['rest', 'webhook', 'otlp', 'bulk']),
    interval: z.number().optional(),
  })).optional(),
});

// ─── C2: Health & Liveness ─────────────────────────────────────────────────
export const contractC2Schema = z.object({
  agentId: z.string().uuid(),
  timestamp: z.string().datetime(),
  modelAvailable: z.boolean(),
  toolConnectivity: z.boolean(),
  latencyP95Ms: z.number().min(0),
  errorRate5m: z.number().min(0).max(1),
  circuitBreakers: z.record(z.string(), z.enum(['open', 'closed', 'half-open'])).default({}),
});

// ─── C3: Traces & Reasoning (metadata for non-OTLP submissions) ───────────
export const contractC3Schema = z.object({
  agentId: z.string().uuid(),
  traceId: z.string().min(1),
  spanId: z.string().min(1).optional(),
  parentSpanId: z.string().optional(),
  operationName: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['ok', 'error', 'unset']).default('unset'),
  events: z.array(z.object({
    name: z.string(),
    timestamp: z.string().datetime(),
    attributes: z.record(z.string(), z.unknown()).default({}),
  })).default([]),
});

// ─── C4: Cost & Usage ──────────────────────────────────────────────────────
export const contractC4Schema = z.object({
  agentId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  monthlyTotal: z.number().min(0),
  costPerInteraction: z.number().min(0),
  llmTokenCost: z.number().min(0),
  toolCallCost: z.number().min(0),
  infraCost: z.number().min(0),
});

// ─── C5: Quality & Drift ───────────────────────────────────────────────────
export const contractC5Schema = z.object({
  agentId: z.string().uuid(),
  driftType: z.enum(['data', 'concept', 'prompt', 'tool_use']),
  statisticalTest: z.string().min(1),
  score: z.number().min(0).max(1),
  severity: z.number().int().min(1).max(4),
  features: z.record(z.string(), z.object({
    psi: z.number().optional(),
    baseline: z.number().optional(),
    current: z.number().optional(),
  })).default({}),
  detectedAt: z.string().datetime().optional(),
});

// ─── C6: Guardrail Events ──────────────────────────────────────────────────
export const contractC6Schema = z.object({
  agentId: z.string().uuid(),
  timestamp: z.string().datetime(),
  railType: z.string().min(1),
  action: z.enum(['block', 'allow', 'modify']),
  triggerReason: z.string().min(1),
  inputHash: z.string().optional(),
  severity: z.number().int().min(1).max(4).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

// ─── C7: Decisions & Delegations ───────────────────────────────────────────
export const contractC7Schema = z.object({
  agentId: z.string().uuid(),
  decisionType: z.string().min(1),
  authorityLevel: z.enum(['A1', 'A2', 'A3', 'A4', 'A5']),
  confidenceScore: z.number().min(0).max(1),
  monetaryImpact: z.number().default(0),
  reversibility: z.enum(['reversible', 'partially_reversible', 'irreversible']),
  delegatedTo: z.string().uuid().nullable().default(null),
  traceId: z.string().optional(),
  reasoning: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

// ─── Bulk Import ───────────────────────────────────────────────────────────
export const bulkImportSchema = z.object({
  contractType: z.enum(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']),
  records: z.array(z.record(z.string(), z.unknown())).min(1).max(10000),
});

// ─── Contract type map ─────────────────────────────────────────────────────
export const CONTRACT_SCHEMAS = {
  C1: contractC1Schema,
  C2: contractC2Schema,
  C3: contractC3Schema,
  C4: contractC4Schema,
  C5: contractC5Schema,
  C6: contractC6Schema,
  C7: contractC7Schema,
} as const;

export type ContractType = keyof typeof CONTRACT_SCHEMAS;

export type ContractC1 = z.infer<typeof contractC1Schema>;
export type ContractC2 = z.infer<typeof contractC2Schema>;
export type ContractC3 = z.infer<typeof contractC3Schema>;
export type ContractC4 = z.infer<typeof contractC4Schema>;
export type ContractC5 = z.infer<typeof contractC5Schema>;
export type ContractC6 = z.infer<typeof contractC6Schema>;
export type ContractC7 = z.infer<typeof contractC7Schema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
