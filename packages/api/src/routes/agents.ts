import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { createAgentSchema, updateAgentSchema, ariScoresSchema } from '@governance/shared';
import { computeARIScore, ariToContainmentLevel } from '@governance/shared';

export async function agentRoutes(app: FastifyInstance) {

  // GET /agents — list all agents
  app.get('/agents', async (request) => {
    const { team, riskTier, healthState } = request.query as Record<string, string>;

    let query = db.select().from(schema.agents);

    // Note: filtering would use .where() chains — simplified for MVP
    const agents = await db.select().from(schema.agents);
    return { data: agents, total: agents.length };
  });

  // GET /agents/:id — single agent detail
  app.get('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, id));
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return agent;
  });

  // POST /agents — register new agent
  app.post('/agents', async (request, reply) => {
    const parsed = createAgentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [agent] = await db.insert(schema.agents).values(parsed.data).returning();
    return reply.code(201).send(agent);
  });

  // PATCH /agents/:id — update agent
  app.patch('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateAgentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const [updated] = await db
      .update(schema.agents)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.agents.id, id))
      .returning();

    if (!updated) return reply.code(404).send({ error: 'Agent not found' });
    return updated;
  });

  // DELETE /agents/:id
  app.delete('/agents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db.delete(schema.agents).where(eq(schema.agents.id, id)).returning();
    if (!deleted) return reply.code(404).send({ error: 'Agent not found' });
    return { success: true };
  });

  // GET /agents/:id/health — latest health check
  app.get('/agents/:id/health', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [health] = await db
      .select()
      .from(schema.healthChecks)
      .where(eq(schema.healthChecks.agentId, id))
      .orderBy(desc(schema.healthChecks.timestamp))
      .limit(1);

    if (!health) return reply.code(404).send({ error: 'No health check found' });
    return health;
  });

  // GET /agents/:id/kpis — agent KPIs
  app.get('/agents/:id/kpis', async (request) => {
    const { id } = request.params as { id: string };
    const kpis = await db.select().from(schema.agentKpis).where(eq(schema.agentKpis.agentId, id));
    return { data: kpis };
  });

  // GET /agents/:id/ari — ARI score history
  app.get('/agents/:id/ari', async (request) => {
    const { id } = request.params as { id: string };
    const calculations = await db
      .select()
      .from(schema.ariCalculations)
      .where(eq(schema.ariCalculations.agentId, id))
      .orderBy(desc(schema.ariCalculations.calculatedAt))
      .limit(20);
    return { data: calculations };
  });

  // POST /agents/:id/ari/recalculate — recalculate ARI
  app.post('/agents/:id/ari/recalculate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ariScoresSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const compositeScore = computeARIScore(parsed.data);
    const containmentLevel = ariToContainmentLevel(compositeScore);
    const governanceTier = compositeScore <= 0.25 ? 'basic'
      : compositeScore <= 0.50 ? 'semi'
      : compositeScore <= 0.75 ? 'highly'
      : 'fully';

    // Insert ARI calculation
    const [calc] = await db.insert(schema.ariCalculations).values({
      agentId: id,
      autonomyScores: parsed.data.autonomy,
      adaptabilityScores: parsed.data.adaptability,
      continuityScores: parsed.data.continuity,
      compositeScore: compositeScore.toString(),
      governanceTier: governanceTier as 'basic' | 'semi' | 'highly' | 'fully',
    }).returning();

    // Update agent ARI score and containment level
    await db.update(schema.agents).set({
      ariScore: compositeScore.toString(),
      currentContainmentLevel: containmentLevel,
      updatedAt: new Date(),
    }).where(eq(schema.agents.id, id));

    return { calculation: calc, containmentLevel };
  });

  // GET /agents/:id/containment — current containment state
  app.get('/agents/:id/containment', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [agent] = await db.select({
      ariScore: schema.agents.ariScore,
      currentContainmentLevel: schema.agents.currentContainmentLevel,
      agentName: schema.agents.agentName,
    }).from(schema.agents).where(eq(schema.agents.id, id));

    if (!agent) return reply.code(404).send({ error: 'Agent not found' });

    const { CONTAINMENT_DEFAULTS } = await import('@governance/shared');
    const level = agent.currentContainmentLevel as 0 | 1 | 2 | 3 | 4;

    return {
      level,
      ...CONTAINMENT_DEFAULTS[level],
      ariScore: agent.ariScore,
      agentName: agent.agentName,
    };
  });

  // POST /agents/:id/circuit-breaker — emergency kill switch
  app.post('/agents/:id/circuit-breaker', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [updated] = await db.update(schema.agents).set({
      currentContainmentLevel: 4,
      healthState: 'critical',
      updatedAt: new Date(),
    }).where(eq(schema.agents.id, id)).returning();

    if (!updated) return reply.code(404).send({ error: 'Agent not found' });
    return { success: true, message: `Agent ${updated.agentName} isolated at Level 4`, agent: updated };
  });

  // GET /agents/:id/cost — cost records
  app.get('/agents/:id/cost', async (request) => {
    const { id } = request.params as { id: string };
    const costs = await db.select().from(schema.costRecords).where(eq(schema.costRecords.agentId, id));
    return { data: costs };
  });

  // GET /agents/:id/drift — drift results
  app.get('/agents/:id/drift', async (request) => {
    const { id } = request.params as { id: string };
    const drifts = await db
      .select()
      .from(schema.driftResults)
      .where(eq(schema.driftResults.agentId, id))
      .orderBy(desc(schema.driftResults.timestamp));
    return { data: drifts };
  });
}
