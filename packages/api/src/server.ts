import Fastify from 'fastify';
import cors from '@fastify/cors';
import { agentRoutes } from './routes/agents.js';
import { governanceRoutes } from './routes/governance.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { registerWebhookReceiver } from './ingestion/webhook-receiver.js';
import { registerBulkImporter } from './ingestion/bulk-importer.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Health check (both root and under API prefix for Docker/Nginx)
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/api/v1/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.register(agentRoutes, { prefix: '/api/v1' });
app.register(governanceRoutes, { prefix: '/api/v1' });
app.register(dashboardRoutes, { prefix: '/api/v1' });

// Tool-agnostic ingestion layer
app.register(registerWebhookReceiver);
app.register(registerBulkImporter);

const port = parseInt(process.env.API_PORT || '4000', 10);
const host = process.env.API_HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`🏛️  Governance API running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
