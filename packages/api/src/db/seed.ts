import { db, schema } from './connection.js';

const DEMO_AGENTS = [
  {
    agentName: 'Customer Support Agent',
    agentType: 'conversational',
    version: '2.1.0',
    modelId: 'claude-3-5-sonnet',
    modelVersion: '20241022',
    deployEnv: 'production' as const,
    healthState: 'healthy' as const,
    riskTier: 'limited' as const,
    oversightModel: 'HOTL' as const,
    ariScore: '0.35',
    currentContainmentLevel: 0,
    owner: 'Sarah Chen',
    team: 'Customer Experience',
    functions: ['answer_faq', 'create_ticket', 'escalate_to_human'],
    outOfScope: ['process_refund', 'access_billing'],
  },
  {
    agentName: 'Fraud Detection Agent',
    agentType: 'autonomous',
    version: '1.4.2',
    modelId: 'claude-3-5-sonnet',
    modelVersion: '20241022',
    deployEnv: 'production' as const,
    healthState: 'degraded' as const,
    riskTier: 'high' as const,
    oversightModel: 'HITL' as const,
    ariScore: '0.72',
    currentContainmentLevel: 2,
    owner: 'James Rivera',
    team: 'Risk & Compliance',
    functions: ['analyze_transaction', 'flag_suspicious', 'block_account'],
    outOfScope: ['approve_loan', 'modify_credit_limit'],
  },
  {
    agentName: 'Content Moderation Agent',
    agentType: 'classifier',
    version: '3.0.1',
    modelId: 'claude-3-haiku',
    modelVersion: '20240307',
    deployEnv: 'production' as const,
    healthState: 'healthy' as const,
    riskTier: 'limited' as const,
    oversightModel: 'HOTA' as const,
    ariScore: '0.18',
    currentContainmentLevel: 0,
    owner: 'Maria Santos',
    team: 'Trust & Safety',
    functions: ['classify_content', 'auto_remove_spam', 'flag_for_review'],
    outOfScope: ['ban_user', 'delete_account'],
  },
  {
    agentName: 'KYC Verification Agent',
    agentType: 'document_processor',
    version: '1.0.0',
    modelId: 'claude-3-5-sonnet',
    modelVersion: '20241022',
    deployEnv: 'staging' as const,
    healthState: 'unknown' as const,
    riskTier: 'high' as const,
    oversightModel: 'HITL' as const,
    ariScore: '0.81',
    currentContainmentLevel: 3,
    owner: 'Alex Kim',
    team: 'Risk & Compliance',
    functions: ['extract_document_data', 'verify_identity', 'risk_score'],
    outOfScope: ['approve_application', 'issue_credit'],
  },
];

const DEMO_SAFEST_ITEMS = [
  { pillar: 'soundness' as const, category: 'Model Validation', itemCode: 'S-01', itemText: 'Model validation framework is documented and followed', priority: 'must_have' as const },
  { pillar: 'soundness' as const, category: 'Model Validation', itemCode: 'S-02', itemText: 'Independent model validation for high-risk models', priority: 'must_have' as const },
  { pillar: 'soundness' as const, category: 'Performance', itemCode: 'S-03', itemText: 'Performance benchmarks established with acceptance criteria', priority: 'must_have' as const },
  { pillar: 'accountability' as const, category: 'Governance', itemCode: 'A-01', itemText: 'AI governance framework approved by senior management', priority: 'must_have' as const },
  { pillar: 'accountability' as const, category: 'Roles', itemCode: 'A-02', itemText: 'Clear roles and responsibilities for AI oversight (RACI)', priority: 'must_have' as const },
  { pillar: 'accountability' as const, category: 'Audit', itemCode: 'A-09', itemText: 'Kill switch / circuit breaker mechanism for critical agents', priority: 'must_have' as const },
  { pillar: 'accountability' as const, category: 'Audit', itemCode: 'A-11', itemText: 'Decision audit trail for autonomous agent actions', priority: 'must_have' as const },
  { pillar: 'fairness' as const, category: 'Bias', itemCode: 'F-01', itemText: 'Bias detection framework for model outputs', priority: 'must_have' as const },
  { pillar: 'fairness' as const, category: 'Bias', itemCode: 'F-02', itemText: 'Demographic parity metrics tracked continuously', priority: 'should_have' as const },
  { pillar: 'explainability' as const, category: 'Transparency', itemCode: 'E-01', itemText: 'Model decision explanations available to end users', priority: 'must_have' as const },
  { pillar: 'sustainability' as const, category: 'Monitoring', itemCode: 'SU-01', itemText: 'Continuous monitoring of model performance in production', priority: 'must_have' as const },
  { pillar: 'sustainability' as const, category: 'Drift', itemCode: 'SU-02', itemText: 'Data and concept drift detection mechanisms in place', priority: 'must_have' as const },
  { pillar: 'transparency' as const, category: 'Documentation', itemCode: 'T-01', itemText: 'AI system documentation per EU AI Act Article 11', priority: 'must_have' as const },
  { pillar: 'transparency' as const, category: 'Tracing', itemCode: 'T-16', itemText: 'Full trace reconstruction capability for agent reasoning', priority: 'must_have' as const },
];

async function seed() {
  console.log('Seeding database...');

  // Seed agents
  const insertedAgents = await db.insert(schema.agents).values(DEMO_AGENTS).returning();
  console.log(`Inserted ${insertedAgents.length} demo agents`);

  // Seed SAFEST items
  await db.insert(schema.safestItems).values(DEMO_SAFEST_ITEMS);
  console.log(`Inserted ${DEMO_SAFEST_ITEMS.length} SAFEST items`);

  // Seed demo KPIs for first agent
  const firstAgent = insertedAgents[0];
  await db.insert(schema.agentKpis).values([
    {
      agentId: firstAgent.id,
      kpiName: 'Task Completion Rate',
      metricId: 'RUN-01',
      definition: 'Percentage of user requests successfully completed',
      target: '0.95',
      warningThreshold: '0.90',
      criticalThreshold: '0.85',
      measurementWindow: '1h',
      dataSource: 'langsmith',
      currentValue: '0.93',
      currentStatus: 'amber' as const,
    },
    {
      agentId: firstAgent.id,
      kpiName: 'Response Latency P95',
      metricId: 'RUN-02',
      definition: 'P95 response latency in milliseconds',
      target: '2000',
      warningThreshold: '3000',
      criticalThreshold: '5000',
      measurementWindow: '5m',
      dataSource: 'otel',
      currentValue: '1850',
      currentStatus: 'green' as const,
    },
    {
      agentId: firstAgent.id,
      kpiName: 'Guardrail Trigger Rate',
      metricId: 'RUN-06',
      definition: 'Percentage of interactions triggering guardrails',
      target: '0.02',
      warningThreshold: '0.05',
      criticalThreshold: '0.10',
      measurementWindow: '1h',
      dataSource: 'nemo',
      currentValue: '0.03',
      currentStatus: 'amber' as const,
    },
  ]);
  console.log('Inserted demo KPIs');

  // Seed ingestion sources for first two agents
  await db.insert(schema.ingestionSources).values([
    { agentId: insertedAgents[0].id, contractType: 'C2' as any, providerName: 'custom-healthcheck', protocol: 'webhook' as any, enabled: true, lastReceivedAt: new Date() },
    { agentId: insertedAgents[0].id, contractType: 'C3' as any, providerName: 'langsmith', protocol: 'otlp' as any, enabled: true, lastReceivedAt: new Date() },
    { agentId: insertedAgents[0].id, contractType: 'C4' as any, providerName: 'langfuse', protocol: 'webhook' as any, enabled: true, lastReceivedAt: new Date() },
    { agentId: insertedAgents[1].id, contractType: 'C2' as any, providerName: 'custom-healthcheck', protocol: 'webhook' as any, enabled: true, lastReceivedAt: new Date() },
    { agentId: insertedAgents[1].id, contractType: 'C3' as any, providerName: 'arize-phoenix', protocol: 'otlp' as any, enabled: true, lastReceivedAt: new Date() },
    { agentId: insertedAgents[1].id, contractType: 'C4' as any, providerName: 'custom-billing', protocol: 'webhook' as any, enabled: true },
    { agentId: insertedAgents[1].id, contractType: 'C5' as any, providerName: 'arize-phoenix', protocol: 'webhook' as any, enabled: true },
    { agentId: insertedAgents[1].id, contractType: 'C7' as any, providerName: 'custom-sdk', protocol: 'webhook' as any, enabled: true },
  ]);
  console.log('Inserted demo ingestion sources');

  // Seed a demo user
  await db.insert(schema.users).values({
    email: 'admin@governance.local',
    name: 'Admin User',
    role: 'admin',
    tierAccess: [1, 2, 3, 4],
  });
  console.log('Inserted demo user');

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
