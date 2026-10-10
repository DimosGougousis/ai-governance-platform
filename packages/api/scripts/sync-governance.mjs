// Copy the governance repo's policy of record into packages/api/governance.
// Usage: GOVERNANCE_REPO_DIR=/path/to/ProductGovernance4AgenticWorkflows pnpm governance:sync
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOVERNANCE_FILES } from './governance-files.mjs';

const source = process.env.GOVERNANCE_REPO_DIR;
if (!source) {
  console.error('GOVERNANCE_REPO_DIR is required');
  process.exit(1);
}
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../governance');

for (const [from, to] of GOVERNANCE_FILES) {
  const text = fs.readFileSync(path.join(source, from), 'utf8').replace(/\r\n/g, '\n');
  const dest = path.join(target, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text, 'utf8');
  console.log(`synced ${to}`);
}
