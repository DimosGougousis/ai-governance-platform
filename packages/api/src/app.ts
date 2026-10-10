import Fastify from 'fastify';
import cors from '@fastify/cors';
import { agentRoutes } from './routes/agents.js';
import { governanceRoutes } from './routes/governance.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { registerWebhookReceiver } from './ingestion/webhook-receiver.js';
import { registerBulkImporter } from './ingestion/bulk-importer.js';
import { enforcementRoutes, type EnforcementDeps } from './enforcement/index.js';

export async function buildApp(enforcement: EnforcementDeps, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? true });

  await app.register(cors, { origin: true });

  // Health check (both root and under API prefix for Docker/Nginx)
  const health = async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    registry_errors: enforcement.getRegistry().errors,
  });
  app.get('/health', health);
  app.get('/api/v1/health', health);

  // API routes
  app.register(agentRoutes, { prefix: '/api/v1' });
  app.register(governanceRoutes, { prefix: '/api/v1' });
  app.register(dashboardRoutes, { prefix: '/api/v1' });

  // Pre-execution enforcement: the policy decision point for the MCP gateway
  app.register(enforcementRoutes(enforcement), { prefix: '/api/v1' });

  // Tool-agnostic ingestion layer
  app.register(registerWebhookReceiver);
  app.register(registerBulkImporter);

  return app;
}
