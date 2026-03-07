export type HealthState = 'healthy' | 'degraded' | 'critical' | 'unknown';
export type OversightModel = 'HITL' | 'HOTL' | 'HOTA';
export type RiskTier = 'minimal' | 'limited' | 'high' | 'unacceptable';
export type GovernanceTier = 'basic' | 'semi' | 'highly' | 'fully';

export interface Agent {
  id: string;
  agentName: string;
  agentType: string;
  version: string;
  modelId: string;
  modelVersion: string;
  deployEnv: string;
  healthState: HealthState;
  riskTier: RiskTier;
  oversightModel: OversightModel;
  nhiIdentity: string | null;
  spiffeId: string | null;
  ariScore: number | null;
  currentContainmentLevel: number;
  businessOwnerId: string | null;
  roiBaseline: Record<string, unknown> | null;
  dutchAlgorithmRegisterId: string | null;
  owner: string;
  team: string;
  functions: string[];
  outOfScope: string[];
  safetyPolicyRef: string | null;
  fallbackRef: string | null;
  guardrailRef: string | null;
  evalSuiteRef: string | null;
  createdAt: string;
  updatedAt: string;
  lastDeployDate: string | null;
}

export interface AgentKpi {
  id: string;
  agentId: string;
  kpiName: string;
  metricId: string;
  definition: string;
  target: number;
  warningThreshold: number;
  criticalThreshold: number;
  measurementWindow: string;
  dataSource: string;
  currentValue: number | null;
  currentStatus: 'green' | 'amber' | 'red' | null;
}

export interface HealthCheck {
  id: string;
  agentId: string;
  timestamp: string;
  modelAvailable: boolean;
  toolConnectivity: boolean;
  latencyP95Ms: number;
  errorRate5m: number;
  circuitBreakers: Record<string, string>;
  lastInteraction: string | null;
}

export interface CostRecord {
  id: string;
  agentId: string;
  period: string;
  monthlyTotal: number;
  costPerInteraction: number;
  llmTokenCost: number;
  toolCallCost: number;
  infraCost: number;
}

export interface DriftResult {
  id: string;
  agentId: string;
  driftType: 'data' | 'concept' | 'prompt' | 'tool_use';
  statisticalTest: string;
  score: number;
  severity: 1 | 2 | 3 | 4;
  features: Record<string, unknown>;
  detectionMethod: string;
  remediationStatus: string;
  timestamp: string;
}
