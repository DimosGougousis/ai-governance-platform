import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { createEnforcement } from './enforcement/index.js';
import { PgStateStore } from './enforcement/pg-state-store.js';
import { db } from './db/connection.js';

const governanceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../governance');

const enforcement = createEnforcement({
  registryDir: process.env.GOVERNANCE_REGISTRY_DIR || path.join(governanceDir, 'registry'),
  schemaDir: process.env.GOVERNANCE_SCHEMA_DIR || path.join(governanceDir, 'schemas'),
  cedarDir: process.env.CEDAR_POLICY_DIR || path.join(governanceDir, 'cedar'),
  store: new PgStateStore(db),
});

const app = await buildApp(enforcement);

const port = parseInt(process.env.API_PORT || '4000', 10);
const host = process.env.API_HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`🏛️  Governance API running at http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
