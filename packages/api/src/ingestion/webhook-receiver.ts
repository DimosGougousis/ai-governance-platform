import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { validateContract } from './contract-validator.js';
import { normalize } from './normalizer.js';
import { db } from '../db/connection.js';
import {
  healthChecks, costRecords, driftResults,
  guardrailEvents, autonomousDecisions, ingestionSources, agents,
} from '../db/schema.js';
import type { ContractType } from '@governance/shared';

const CONTRACT_TO_TABLE = {
  C2: healthChecks,
  C4: costRecords,
  C5: driftResults,
  C6: guardrailEvents,
  C7: autonomousDecisions,
} as const;

type WebhookContractType = keyof typeof CONTRACT_TO_TABLE;

/**
 * REST Webhook receiver for Governance Data Contracts C2, C4, C5, C6, C7.
 * Tool-agnostic: validates schema, normalizes, stores — doesn't care about the source.
 *
 * POST /api/v1/ingest/:contractType
 */
export async function registerWebhookReceiver(app: FastifyInstance) {
  // Generic contract ingestion endpoint
  app.post<{ Params: { contractType: string } }>(
    '/api/v1/ingest/:contractType',
    async (request: FastifyRequest<{ Params: { contractType: string } }>, reply: FastifyReply) => {
      const { contractType } = request.params;
      const upperType = contractType.toUpperCase() as ContractType;

      // C1 handled by agent CRUD, C3 handled by OTLP receiver
      if (upperType === 'C1') {
        return reply.status(400).send({
          error: 'C1 (Identity) contracts are submitted via POST /api/v1/agents',
        });
      }
      if (upperType === 'C3') {
        return reply.status(400).send({
          error: 'C3 (Traces) contracts are submitted via OpenTelemetry OTLP on ports 4317/4318',
        });
      }

      if (!['C2', 'C4', 'C5', 'C6', 'C7'].includes(upperType)) {
        return reply.status(400).send({
          error: `Invalid contract type: ${contractType}. Valid webhook types: C2, C4, C5, C6, C7`,
        });
      }

      // Validate against contract schema
      const validation = validateContract(upperType, request.body);
      if (!validation.success) {
        return reply.status(422).send({
          error: 'Contract validation failed',
          contractType: upperType,
          issues: validation.errors,
        });
      }

      // Verify agent exists
      const agentId = (validation.data as Record<string, unknown>).agentId as string;
      const [agent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, agentId)).limit(1);
      if (!agent) {
        return reply.status(404).send({ error: `Agent ${agentId} not found` });
      }

      // Normalize for DB insertion
      const normalized = normalize(upperType, validation.data as Record<string, unknown>);
      if (!normalized) {
        return reply.status(500).send({ error: 'Normalization failed' });
      }

      // Insert into appropriate table
      const table = CONTRACT_TO_TABLE[upperType as WebhookContractType];
      await db.insert(table).values(normalized.data as any);

      // Update ingestion source tracking
      await updateIngestionSource(agentId, upperType, true);

      return reply.status(201).send({
        status: 'accepted',
        contractType: upperType,
        agentId,
        receivedAt: validation.receivedAt,
      });
    },
  );

  // Contract compliance check endpoint
  app.get<{ Params: { agentId: string } }>(
    '/api/v1/agents/:agentId/contracts',
    async (request: FastifyRequest<{ Params: { agentId: string } }>, reply: FastifyReply) => {
      const { agentId } = request.params;

      const [agent] = await db.select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      if (!agent) {
        return reply.status(404).send({ error: 'Agent not found' });
      }

      const sources = await db.select()
        .from(ingestionSources)
        .where(eq(ingestionSources.agentId, agentId));

      const satisfiedContracts = sources
        .filter(s => s.enabled && s.lastReceivedAt)
        .map(s => s.contractType as ContractType);

      const { checkContractCompliance } = await import('./contract-validator.js');
      const compliance = checkContractCompliance(agent.riskTier, satisfiedContracts);

      return {
        agentId,
        riskTier: agent.riskTier,
        ...compliance,
        sources: sources.map(s => ({
          contractType: s.contractType,
          provider: s.providerName,
          protocol: s.protocol,
          lastReceived: s.lastReceivedAt,
          schemaValid: s.schemaValid,
          enabled: s.enabled,
        })),
      };
    },
  );
}

async function updateIngestionSource(agentId: string, contractType: string, schemaValid: boolean) {
  const existing = await db.select()
    .from(ingestionSources)
    .where(and(
      eq(ingestionSources.agentId, agentId),
      eq(ingestionSources.contractType, contractType as any),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(ingestionSources)
      .set({ lastReceivedAt: new Date(), schemaValid })
      .where(eq(ingestionSources.id, existing[0].id));
  } else {
    await db.insert(ingestionSources).values({
      agentId,
      contractType: contractType as any,
      providerName: 'auto-detected',
      protocol: 'webhook' as any,
      lastReceivedAt: new Date(),
      schemaValid,
    });
  }
}
