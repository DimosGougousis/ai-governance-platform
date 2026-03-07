import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';

export async function governanceRoutes(app: FastifyInstance) {

  // GET /governance/safest — all SAFEST items with pillar scores
  app.get('/governance/safest', async () => {
    const items = await db.select().from(schema.safestItems);

    // Calculate pillar scores
    const pillars = ['soundness', 'accountability', 'fairness', 'explainability', 'sustainability', 'transparency'] as const;
    const scores = pillars.map(pillar => {
      const pillarItems = items.filter(i => i.pillar === pillar);
      const total = pillarItems.length;
      const compliant = pillarItems.filter(i => i.status === 'compliant').length;
      const inProgress = pillarItems.filter(i => i.status === 'in_progress').length;
      const notStarted = pillarItems.filter(i => i.status === 'not_started').length;
      const notApplicable = pillarItems.filter(i => i.status === 'not_applicable').length;
      const applicable = total - notApplicable;

      return {
        pillar,
        totalItems: total,
        compliant,
        inProgress,
        notStarted,
        notApplicable,
        score: applicable > 0 ? Math.round((compliant / applicable) * 100) : 0,
      };
    });

    return { items, scores };
  });

  // PATCH /governance/safest/:itemId — update SAFEST item
  app.patch('/governance/safest/:itemId', async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const body = request.body as Record<string, unknown>;

    const allowedFields = ['status', 'evidenceRef', 'notes'];
    const updates: Record<string, unknown> = { lastUpdated: new Date() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const [updated] = await db
      .update(schema.safestItems)
      .set(updates)
      .where(eq(schema.safestItems.id, itemId))
      .returning();

    if (!updated) return reply.code(404).send({ error: 'SAFEST item not found' });
    return updated;
  });

  // GET /governance/maturity — overall governance maturity
  app.get('/governance/maturity', async () => {
    const items = await db.select().from(schema.safestItems);
    const agents = await db.select().from(schema.agents);

    const totalItems = items.filter(i => i.status !== 'not_applicable').length;
    const compliantItems = items.filter(i => i.status === 'compliant').length;
    const overallScore = totalItems > 0 ? Math.round((compliantItems / totalItems) * 100) : 0;

    const agentsWithARI = agents.filter(a => a.ariScore !== null);
    const avgARI = agentsWithARI.length > 0
      ? agentsWithARI.reduce((sum, a) => sum + parseFloat(a.ariScore!), 0) / agentsWithARI.length
      : 0;

    let maturityLevel: string;
    if (overallScore >= 90) maturityLevel = 'Optimizing';
    else if (overallScore >= 70) maturityLevel = 'Managed';
    else if (overallScore >= 50) maturityLevel = 'Defined';
    else if (overallScore >= 25) maturityLevel = 'Developing';
    else maturityLevel = 'Initial';

    return {
      maturityLevel,
      overallComplianceScore: overallScore,
      totalAgents: agents.length,
      averageARI: Math.round(avgARI * 100) / 100,
      agentsInContainment: agents.filter(a => a.currentContainmentLevel > 0).length,
      healthDistribution: {
        healthy: agents.filter(a => a.healthState === 'healthy').length,
        degraded: agents.filter(a => a.healthState === 'degraded').length,
        critical: agents.filter(a => a.healthState === 'critical').length,
        unknown: agents.filter(a => a.healthState === 'unknown').length,
      },
    };
  });

  // GET /governance/integrations — list ingestion sources with status
  app.get('/integrations', async () => {
    const sources = await db.select().from(schema.ingestionSources);
    return { data: sources };
  });
}
