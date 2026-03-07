import {
  pgTable, uuid, varchar, text, integer, decimal, boolean, timestamp,
  jsonb, pgEnum, index, uniqueIndex, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────
export const healthStateEnum = pgEnum('health_state', ['healthy', 'degraded', 'critical', 'unknown']);
export const riskTierEnum = pgEnum('risk_tier', ['minimal', 'limited', 'high', 'unacceptable']);
export const oversightModelEnum = pgEnum('oversight_model', ['HITL', 'HOTL', 'HOTA']);
export const governanceTierEnum = pgEnum('governance_tier', ['basic', 'semi', 'highly', 'fully']);
export const deployEnvEnum = pgEnum('deploy_env', ['development', 'staging', 'production']);
export const kpiStatusEnum = pgEnum('kpi_status', ['green', 'amber', 'red']);
export const driftTypeEnum = pgEnum('drift_type', ['data', 'concept', 'prompt', 'tool_use']);
export const authorityLevelEnum = pgEnum('authority_level', ['A1', 'A2', 'A3', 'A4', 'A5']);
export const reversibilityEnum = pgEnum('reversibility', ['reversible', 'partially_reversible', 'irreversible']);
export const chainStatusEnum = pgEnum('chain_status', ['active', 'completed', 'failed', 'timeout']);
export const incidentSeverityEnum = pgEnum('incident_severity', ['low', 'medium', 'high', 'critical']);
export const incidentStatusEnum = pgEnum('incident_status', ['open', 'investigating', 'mitigated', 'resolved', 'closed']);
export const safestPillarEnum = pgEnum('safest_pillar', ['soundness', 'accountability', 'fairness', 'explainability', 'sustainability', 'transparency']);
export const safestStatusEnum = pgEnum('safest_status', ['not_started', 'in_progress', 'compliant', 'non_compliant', 'not_applicable']);
export const safestPriorityEnum = pgEnum('safest_priority', ['must_have', 'should_have', 'could_have']);
export const guardrailActionEnum = pgEnum('guardrail_action', ['block', 'allow', 'modify']);
export const article11ElementEnum = pgEnum('article11_element', ['description', 'development', 'operation', 'standards', 'conformity']);
export const apSubmissionStatusEnum = pgEnum('ap_submission_status', ['draft', 'ready', 'submitted', 'approved']);

// ─── Core Tables ─────────────────────────────────────

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  agentType: varchar('agent_type', { length: 100 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  modelId: varchar('model_id', { length: 255 }).notNull(),
  modelVersion: varchar('model_version', { length: 50 }).notNull(),
  deployEnv: deployEnvEnum('deploy_env').notNull().default('development'),
  healthState: healthStateEnum('health_state').notNull().default('unknown'),
  riskTier: riskTierEnum('risk_tier').notNull().default('limited'),
  oversightModel: oversightModelEnum('oversight_model').notNull().default('HITL'),
  nhiIdentity: varchar('nhi_identity', { length: 255 }),
  spiffeId: varchar('spiffe_id', { length: 255 }),
  ariScore: decimal('ari_score', { precision: 3, scale: 2 }),
  currentContainmentLevel: integer('current_containment_level').notNull().default(0),
  businessOwnerId: uuid('business_owner_id'),
  roiBaseline: jsonb('roi_baseline'),
  dutchAlgorithmRegisterId: varchar('dutch_algorithm_register_id', { length: 100 }),
  owner: varchar('owner', { length: 255 }).notNull(),
  team: varchar('team', { length: 255 }).notNull(),
  functions: jsonb('functions').notNull().default([]),
  outOfScope: jsonb('out_of_scope').notNull().default([]),
  safetyPolicyRef: varchar('safety_policy_ref', { length: 500 }),
  fallbackRef: varchar('fallback_ref', { length: 500 }),
  guardrailRef: varchar('guardrail_ref', { length: 500 }),
  evalSuiteRef: varchar('eval_suite_ref', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastDeployDate: timestamp('last_deploy_date'),
}, (table) => ({
  teamIdx: index('agents_team_idx').on(table.team),
  healthIdx: index('agents_health_idx').on(table.healthState),
  riskIdx: index('agents_risk_idx').on(table.riskTier),
}));

export const ariCalculations = pgTable('ari_calculations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  autonomyScores: jsonb('autonomy_scores').notNull(),
  adaptabilityScores: jsonb('adaptability_scores').notNull(),
  continuityScores: jsonb('continuity_scores').notNull(),
  compositeScore: decimal('composite_score', { precision: 3, scale: 2 }).notNull(),
  governanceTier: governanceTierEnum('governance_tier').notNull(),
  calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
}, (table) => ({
  agentIdx: index('ari_agent_idx').on(table.agentId),
  calcDateIdx: index('ari_calc_date_idx').on(table.calculatedAt),
}));

export const agentKpis = pgTable('agent_kpis', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  kpiName: varchar('kpi_name', { length: 255 }).notNull(),
  metricId: varchar('metric_id', { length: 100 }).notNull(),
  definition: text('definition').notNull(),
  target: decimal('target', { precision: 10, scale: 4 }).notNull(),
  warningThreshold: decimal('warning_threshold', { precision: 10, scale: 4 }).notNull(),
  criticalThreshold: decimal('critical_threshold', { precision: 10, scale: 4 }).notNull(),
  measurementWindow: varchar('measurement_window', { length: 50 }).notNull(),
  dataSource: varchar('data_source', { length: 255 }).notNull(),
  currentValue: decimal('current_value', { precision: 10, scale: 4 }),
  currentStatus: kpiStatusEnum('current_status'),
});

export const healthChecks = pgTable('health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  modelAvailable: boolean('model_available').notNull(),
  toolConnectivity: boolean('tool_connectivity').notNull(),
  latencyP95Ms: integer('latency_p95_ms').notNull(),
  errorRate5m: decimal('error_rate_5m', { precision: 5, scale: 4 }).notNull(),
  circuitBreakers: jsonb('circuit_breakers').notNull().default({}),
  lastInteraction: timestamp('last_interaction'),
});

export const driftResults = pgTable('drift_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  driftType: driftTypeEnum('drift_type').notNull(),
  statisticalTest: varchar('statistical_test', { length: 100 }).notNull(),
  score: decimal('score', { precision: 8, scale: 6 }).notNull(),
  severity: integer('severity').notNull(),
  features: jsonb('features').notNull().default({}),
  detectionMethod: varchar('detection_method', { length: 100 }).notNull(),
  remediationStatus: varchar('remediation_status', { length: 50 }).notNull().default('pending'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const costRecords = pgTable('cost_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  period: varchar('period', { length: 20 }).notNull(),
  monthlyTotal: decimal('monthly_total', { precision: 12, scale: 2 }).notNull(),
  costPerInteraction: decimal('cost_per_interaction', { precision: 8, scale: 4 }).notNull(),
  llmTokenCost: decimal('llm_token_cost', { precision: 12, scale: 2 }).notNull(),
  toolCallCost: decimal('tool_call_cost', { precision: 12, scale: 2 }).notNull(),
  infraCost: decimal('infra_cost', { precision: 12, scale: 2 }).notNull(),
});

export const guardrailEvents = pgTable('guardrail_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  railType: varchar('rail_type', { length: 100 }).notNull(),
  action: guardrailActionEnum('action').notNull(),
  triggerReason: text('trigger_reason').notNull(),
  inputHash: varchar('input_hash', { length: 64 }),
  containmentLevel: integer('containment_level'),
  escalationTrigger: varchar('escalation_trigger', { length: 50 }),
  containmentActions: jsonb('containment_actions'),
  humanOwnerNotified: boolean('human_owner_notified').default(false),
  sandboxMigrationRef: uuid('sandbox_migration_ref'),
});

export const delegationChains = pgTable('delegation_chains', {
  id: uuid('id').primaryKey().defaultRandom(),
  traceId: varchar('trace_id', { length: 255 }).notNull(),
  customerId: varchar('customer_id', { length: 255 }),
  initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  chainDepth: integer('chain_depth').notNull().default(0),
  chainStatus: chainStatusEnum('chain_status').notNull().default('active'),
  finalOutcome: text('final_outcome'),
  hitlInvolved: boolean('hitl_involved').notNull().default(false),
});

export const autonomousDecisions = pgTable('autonomous_decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  chainId: uuid('chain_id').references(() => delegationChains.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  decisionType: varchar('decision_type', { length: 100 }).notNull(),
  authorityLevel: authorityLevelEnum('authority_level').notNull(),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }).notNull(),
  monetaryImpact: decimal('monetary_impact', { precision: 12, scale: 2 }),
  reversibility: reversibilityEnum('reversibility').notNull(),
  humanInvolvement: varchar('human_involvement', { length: 100 }).notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  severity: incidentSeverityEnum('severity').notNull(),
  status: incidentStatusEnum('status').notNull().default('open'),
  doraReportingRequired: boolean('dora_reporting_required').notNull().default(false),
  doraDeadline: timestamp('dora_deadline'),
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
  rootCause: text('root_cause'),
  correctiveActions: text('corrective_actions'),
});

export const safestItems = pgTable('safest_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  pillar: safestPillarEnum('pillar').notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  itemCode: varchar('item_code', { length: 20 }).notNull().unique(),
  itemText: text('item_text').notNull(),
  priority: safestPriorityEnum('priority').notNull(),
  status: safestStatusEnum('status').notNull().default('not_started'),
  evidenceRef: varchar('evidence_ref', { length: 500 }),
  regulatoryRef: varchar('regulatory_ref', { length: 500 }),
  notes: text('notes'),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  actorType: varchar('actor_type', { length: 50 }).notNull(),
  actorId: varchar('actor_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  correlationId: uuid('correlation_id'),
  checksum: varchar('checksum', { length: 64 }).notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('viewer'),
  team: varchar('team', { length: 255 }),
  tierAccess: jsonb('tier_access').notNull().default([3]),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contractTypeEnum = pgEnum('contract_type', ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
export const ingestionProtocolEnum = pgEnum('ingestion_protocol', ['otlp', 'webhook', 'bulk']);

export const ingestionSources = pgTable('ingestion_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  contractType: contractTypeEnum('contract_type').notNull(),
  providerName: varchar('provider_name', { length: 255 }).notNull(),
  protocol: ingestionProtocolEnum('protocol').notNull(),
  endpointUrl: varchar('endpoint_url', { length: 500 }),
  apiKeyHash: varchar('api_key_hash', { length: 64 }),
  lastReceivedAt: timestamp('last_received_at'),
  schemaValid: boolean('schema_valid').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  agentContractIdx: index('ingestion_agent_contract_idx').on(table.agentId, table.contractType),
}));

export const article11Documentation = pgTable('article_11_documentation', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  docElement: article11ElementEnum('doc_element').notNull(),
  content: jsonb('content').notNull(),
  versionHash: varchar('version_hash', { length: 64 }).notNull(),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  apSubmissionStatus: apSubmissionStatusEnum('ap_submission_status').notNull().default('draft'),
});

export const swarmTopology = pgTable('swarm_topology', {
  id: uuid('id').primaryKey().defaultRandom(),
  swarmId: uuid('swarm_id').notNull(),
  keystoneAgentId: uuid('keystone_agent_id').notNull().references(() => agents.id),
  downstreamDependencies: jsonb('downstream_dependencies').notNull().default([]),
  cascadingRiskCoefficient: integer('cascading_risk_coefficient').notNull().default(1),
  topologyGraph: jsonb('topology_graph').notNull().default({}),
});

export const nhiCredentials = pgTable('nhi_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  spiffeSvid: text('spiffe_svid'),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  rotationCount: integer('rotation_count').notNull().default(0),
  lastRotatedAt: timestamp('last_rotated_at'),
  revoked: boolean('revoked').notNull().default(false),
  revocationReason: text('revocation_reason'),
  jitTokenHash: varchar('jit_token_hash', { length: 64 }),
});
