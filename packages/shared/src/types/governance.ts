export type SafestPillar = 'soundness' | 'accountability' | 'fairness' | 'explainability' | 'sustainability' | 'transparency';
export type SafestStatus = 'not_started' | 'in_progress' | 'compliant' | 'non_compliant' | 'not_applicable';
export type SafestPriority = 'must_have' | 'should_have' | 'could_have';

export interface SafestItem {
  id: string;
  pillar: SafestPillar;
  category: string;
  itemCode: string;
  itemText: string;
  priority: SafestPriority;
  status: SafestStatus;
  evidenceRef: string | null;
  regulatoryRef: string | null;
  notes: string | null;
  lastUpdated: string;
}

export interface PillarScore {
  pillar: SafestPillar;
  totalItems: number;
  compliant: number;
  inProgress: number;
  notStarted: number;
  notApplicable: number;
  score: number; // 0-100 percentage
}

export type AuthorityLevel = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';

export interface AutonomousDecision {
  id: string;
  chainId: string | null;
  agentId: string;
  decisionType: string;
  authorityLevel: AuthorityLevel;
  confidenceScore: number;
  monetaryImpact: number | null;
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible';
  humanInvolvement: string;
  timestamp: string;
}

export interface DelegationChain {
  id: string;
  traceId: string;
  customerId: string | null;
  initiatedAt: string;
  completedAt: string | null;
  chainDepth: number;
  chainStatus: 'active' | 'completed' | 'failed' | 'timeout';
  finalOutcome: string | null;
  hitlInvolved: boolean;
}

export interface Incident {
  id: string;
  agentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'mitigated' | 'resolved' | 'closed';
  doraReportingRequired: boolean;
  doraDeadline: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  rootCause: string | null;
  correctiveActions: string | null;
}

export type TierLevel = 1 | 2 | 3 | 4;

export interface DashboardMetric {
  metricId: string;
  label: string;
  value: number;
  unit: string;
  status: 'green' | 'amber' | 'red';
  trend: 'up' | 'down' | 'stable';
  tier: TierLevel;
}
