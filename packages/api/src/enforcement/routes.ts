import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { decide, type DecideDeps } from './decide.js';
import type { Registry } from './registry.js';
import { APPROVAL_STATUSES } from './state-store.js';

export interface EnforcementDeps extends DecideDeps {
  reloadRegistry(): Registry;
}

const decideBody = z.object({
  agent_id: z.string().min(1),
  server_id: z.string().min(1),
  server_version: z.string(),
  operation: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
  observed_description_sha256: z.string(),
  user_claims: z.record(z.unknown()).default({}),
});
const verdictBody = z.object({ approver_name: z.string().min(1), approver_role: z.string().min(1) });
const statusQuery = z.object({ status: z.enum(APPROVAL_STATUSES).optional() });

export function enforcementRoutes(deps: EnforcementDeps) {
  return async function routes(app: FastifyInstance) {
    app.post('/decide', async (request, reply) => {
      const parsed = decideBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      return decide(deps, parsed.data);
    });

    app.get('/approvals', async (request, reply) => {
      const parsed = statusQuery.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      return { data: await deps.store.listApprovals(parsed.data.status, deps.now()) };
    });

    for (const [path, verdict] of [['approve', 'approved'], ['reject', 'rejected']] as const) {
      app.post(`/approvals/:id/${path}`, async (request, reply) => {
        const parsed = verdictBody.safeParse(request.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        const { id } = request.params as { id: string };
        const result = await deps.store.decideApproval(id, verdict, parsed.data.approver_name, parsed.data.approver_role, deps.now());
        if (result === null) return reply.code(404).send({ error: 'Approval not found' });
        if (result === 'conflict') return reply.code(409).send({ error: 'Approval is not pending' });
        return result;
      });
    }

    app.post('/registry/reload', async () => {
      const reg = deps.reloadRegistry();
      return {
        passports: reg.passportsByPrincipal.size,
        servers: reg.serversById.size,
        boundaries: reg.boundaries.size,
        errors: reg.errors,
      };
    });
  };
}
