import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { validateBatch } from './contract-validator.js';
import { normalize } from './normalizer.js';
import { db } from '../db/connection.js';
import {
  healthChecks, costRecords, driftResults,
  guardrailEvents, autonomousDecisions, agents,
} from '../db/schema.js';
import { bulkImportSchema, type ContractType } from '@governance/shared';

const CONTRACT_TO_TABLE: Record<string, any> = {
  C2: healthChecks,
  C4: costRecords,
  C5: driftResults,
  C6: guardrailEvents,
  C7: autonomousDecisions,
};

/**
 * Bulk JSON/CSV importer for batch data migration.
 * Accepts a contract type + array of records, validates each,
 * normalizes, and inserts in a single transaction.
 *
 * POST /api/v1/ingest/bulk
 */
export async function registerBulkImporter(app: FastifyInstance) {
  app.post(
    '/api/v1/ingest/bulk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validate the bulk import wrapper
      const parseResult = bulkImportSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(422).send({
          error: 'Invalid bulk import format',
          issues: parseResult.error.issues,
          expected: {
            contractType: 'C1 | C2 | C3 | C4 | C5 | C6 | C7',
            records: '[...array of contract-conformant objects]',
          },
        });
      }

      const { contractType, records } = parseResult.data;

      // C1 and C3 not supported via bulk
      if (contractType === 'C1' || contractType === 'C3') {
        return reply.status(400).send({
          error: `Contract ${contractType} is not supported via bulk import. Use the appropriate protocol.`,
        });
      }

      const table = CONTRACT_TO_TABLE[contractType];
      if (!table) {
        return reply.status(400).send({ error: `No bulk handler for contract ${contractType}` });
      }

      // Validate all records against the contract schema
      const { valid, invalid } = validateBatch(contractType as ContractType, records);

      if (valid.length === 0) {
        return reply.status(422).send({
          error: 'No valid records in batch',
          totalRecords: records.length,
          invalidCount: invalid.length,
          sampleErrors: invalid.slice(0, 5).map(r => r.errors),
        });
      }

      // Verify all referenced agents exist
      const agentIds = [...new Set(valid.map(r => (r.data as Record<string, unknown>).agentId as string))];
      const existingAgents = await db.select({ id: agents.id })
        .from(agents);
      const existingIds = new Set(existingAgents.map(a => a.id));
      const missingAgents = agentIds.filter(id => !existingIds.has(id));

      if (missingAgents.length > 0) {
        return reply.status(404).send({
          error: 'Some referenced agents do not exist',
          missingAgents,
        });
      }

      // Normalize and insert
      const normalizedRows: Record<string, unknown>[] = [];
      for (const record of valid) {
        const normalized = normalize(contractType as ContractType, record.data as Record<string, unknown>);
        if (normalized) {
          normalizedRows.push(normalized.data);
        }
      }

      if (normalizedRows.length > 0) {
        // Insert in batches of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < normalizedRows.length; i += BATCH_SIZE) {
          const batch = normalizedRows.slice(i, i + BATCH_SIZE);
          await db.insert(table).values(batch as any);
        }
      }

      return reply.status(201).send({
        status: 'imported',
        contractType,
        totalRecords: records.length,
        insertedCount: normalizedRows.length,
        invalidCount: invalid.length,
        invalidSamples: invalid.length > 0
          ? invalid.slice(0, 3).map(r => ({ errors: r.errors }))
          : undefined,
      });
    },
  );
}
