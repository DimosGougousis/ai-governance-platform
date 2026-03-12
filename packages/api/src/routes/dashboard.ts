import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db/connection.js';
import { sql, eq, desc } from 'drizzle-orm';

export async function dashboardRoutes(app: FastifyInstance) {

  // GET /governance/dashboard/tier/:tier — tier-specific dashboard data
  app.get('/governance/dashboard/tier/:tier', async (request, reply) => {
    const tier = parseInt((request.params as { tier: string }).tier, 10);
    if (isNaN(tier) || tier < 1 || tier > 4) return reply.code(400).send({ error: 'Tier must be 1-4' });

    const agents = await db.select().from(schema.agents);
    const safestItems = await db.select().from(schema.safestItems);
    const sourcesList = await db.select().from(schema.ingestionSources);

    const compliantItems = safestItems.filter(i => i.status === 'compliant').length;
    const applicableItems = safestItems.filter(i => i.status !== 'not_applicable').length;
    const complianceScore = applicableItems > 0 ? Math.round((compliantItems / applicableItems) * 100) : 0;

    const ariValues = agents.filter(a => a.ariScore !== null).map(a => parseFloat(a.ariScore!));
    const ariDistribution = {
      basic: ariValues.filter(v => v <= 0.25).length,
      semi: ariValues.filter(v => v > 0.25 && v <= 0.50).length,
      highly: ariValues.filter(v => v > 0.50 && v <= 0.75).length,
      fully: ariValues.filter(v => v > 0.75).length,
    };

    const baseData = {
      tier,
      totalAgents: agents.length,
      complianceScore,
      healthDistribution: {
        healthy: agents.filter(a => a.healthState === 'healthy').length,
        degraded: agents.filter(a => a.healthState === 'degraded').length,
        critical: agents.filter(a => a.healthState === 'critical').length,
        unknown: agents.filter(a => a.healthState === 'unknown').length,
      },
      ariDistribution,
      containmentSummary: {
        level0: agents.filter(a => a.currentContainmentLevel === 0).length,
        level1: agents.filter(a => a.currentContainmentLevel === 1).length,
        level2: agents.filter(a => a.currentContainmentLevel === 2).length,
        level3: agents.filter(a => a.currentContainmentLevel === 3).length,
        level4: agents.filter(a => a.currentContainmentLevel === 4).length,
      },
      ingestionSources: {
        total: sourcesList.length,
        active: sourcesList.filter(s => s.enabled).length,
      },
    };

    if (tier === 1) {
      // Board: High-level metrics only
      return {
        ...baseData,
        auditReadiness: agents.length > 0
          ? Math.round((agents.filter(a => a.ariScore !== null).length / agents.length) * 100)
          : 0,
        metrics: [
          { id: 'DISC-01', label: 'SAFEST Compliance', value: complianceScore, unit: '%', status: complianceScore >= 80 ? 'green' : complianceScore >= 60 ? 'amber' : 'red' },
          { id: 'DISC-02', label: 'Agent Fleet Size', value: agents.length, unit: 'agents', status: 'green' },
          { id: 'OPS-01', label: 'Agents in Containment', value: agents.filter(a => a.currentContainmentLevel > 0).length, unit: 'agents', status: agents.filter(a => a.currentContainmentLevel >= 3).length > 0 ? 'red' : 'green' },
        ],
      };
    }

    if (tier === 2) {
      // CAIO: Compliance detail + regulatory
      return {
        ...baseData,
        safestPillars: ['soundness', 'accountability', 'fairness', 'explainability', 'sustainability', 'transparency'].map(pillar => {
          const pillarItems = safestItems.filter(i => i.pillar === pillar);
          const compliant = pillarItems.filter(i => i.status === 'compliant').length;
          const applicable = pillarItems.filter(i => i.status !== 'not_applicable').length;
          return { pillar, score: applicable > 0 ? Math.round((compliant / applicable) * 100) : 0, total: pillarItems.length };
        }),
      };
    }

    if (tier === 3) {
      // Team: Agent list with KPIs
      return {
        ...baseData,
        agents: agents.map(a => ({
          id: a.id,
          name: a.agentName,
          type: a.agentType,
          health: a.healthState,
          riskTier: a.riskTier,
          ariScore: a.ariScore ? parseFloat(a.ariScore) : null,
          containmentLevel: a.currentContainmentLevel,
          team: a.team,
          deployEnv: a.deployEnv,
        })),
      };
    }

    // Tier 4: Runtime
    return {
      ...baseData,
      agents: agents.map(a => ({
        id: a.id,
        name: a.agentName,
        health: a.healthState,
        ariScore: a.ariScore ? parseFloat(a.ariScore) : null,
        containmentLevel: a.currentContainmentLevel,
        oversightModel: a.oversightModel,
      })),
    };
  });
}
