import { z } from 'zod';

export const createAgentSchema = z.object({
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
  safetyPolicyRef: z.string().nullable().default(null),
  fallbackRef: z.string().nullable().default(null),
  guardrailRef: z.string().nullable().default(null),
  evalSuiteRef: z.string().nullable().default(null),
});

export const updateAgentSchema = createAgentSchema.partial();

export const ariScoresSchema = z.object({
  autonomy: z.tuple([z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3)]),
  adaptability: z.tuple([z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3)]),
  continuity: z.tuple([z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3), z.number().min(0).max(3)]),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ARIScoresInput = z.infer<typeof ariScoresSchema>;
