import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { createEnforcement } from '../src/enforcement/index.js';
import { MemoryStateStore } from '../src/enforcement/memory-state-store.js';
import { CEDAR_DIR, FINLEY, FIXED_NOW, SCHEMA_DIR, SERVER, TX_SHA, copyRegistry } from './helpers.js';

let app: FastifyInstance;
afterEach(async () => { await app?.close(); });

async function start(opts: { hitl?: boolean } = {}) {
  const registryDir = copyRegistry((f) => { if (opts.hitl) f.boundary = f.boundary.replace(/read: hota/, 'read: hitl'); });
  const store = new MemoryStateStore();
  store.setAgent(FINLEY, 0);
  app = await buildApp(createEnforcement({ registryDir, schemaDir: SCHEMA_DIR, cedarDir: CEDAR_DIR, store, now: () => FIXED_NOW }), { logger: false });
  return { registryDir, store };
}

const body = {
  agent_id: FINLEY, server_id: SERVER, server_version: '1.4.2', operation: 'get_transactions',
  arguments: { customer_id: 'C-1001' }, observed_description_sha256: TX_SHA, user_claims: { customer_id: 'C-1001' },
};
const decideCall = (payload: unknown = body) => app.inject({ method: 'POST', url: '/api/v1/decide', payload: payload as object });
const verdict = (id: string, v: 'approve' | 'reject', payload: object = { approver_name: 'M. de Boer', approver_role: 'Customer Advisor' }) =>
  app.inject({ method: 'POST', url: `/api/v1/approvals/${id}/${v}`, payload });

describe('POST /api/v1/decide', () => {
  test('answers a decision', async () => {
    await start();
    const res = await decideCall();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ decision: 'allow', enforced: true });
  });

  test('a request missing a field is a 400', async () => {
    await start();
    const { operation: _o, ...missing } = body;
    expect((await decideCall(missing)).statusCode).toBe(400);
  });

  test('arguments and user_claims default to empty objects', async () => {
    await start();
    const { arguments: _a, user_claims: _u, ...bare } = body;
    expect((await decideCall(bare)).json()).toMatchObject({ decision: 'deny', reasons: ['forbid-user-claims-mismatch'] });
  });
});

describe('approvals API', () => {
  test('lists, approves, and refuses to approve twice', async () => {
    await start({ hitl: true });
    const { approval_id } = (await decideCall()).json();
    const pending = (await app.inject({ method: 'GET', url: '/api/v1/approvals?status=pending' })).json();
    expect(pending.data.map((a: { id: string }) => a.id)).toEqual([approval_id]);
    const ok = await verdict(approval_id, 'approve');
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: 'approved', decided_by: 'M. de Boer', decided_role: 'Customer Advisor' });
    expect((await verdict(approval_id, 'approve')).statusCode).toBe(409);
    expect((await decideCall()).json()).toMatchObject({ decision: 'allow', reasons: ['approved-ticket'] });
  });

  test('reject, unknown id, missing role, bad status filter', async () => {
    await start({ hitl: true });
    const { approval_id } = (await decideCall()).json();
    expect((await verdict(approval_id, 'reject')).json()).toMatchObject({ status: 'rejected' });
    expect((await verdict('apr_missing', 'approve')).statusCode).toBe(404);
    expect((await verdict(approval_id, 'approve', { approver_name: 'X' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/v1/approvals?status=bogus' })).statusCode).toBe(400);
  });
});

describe('registry reload and health', () => {
  test('a removed passport takes effect on reload, and errors show on /health', async () => {
    const { registryDir } = await start();
    fs.writeFileSync(path.join(registryDir, 'passports/finley.yaml'), 'agent_id: broken\n');
    expect((await decideCall()).json().decision).toBe('allow'); // still the loaded registry
    const reload = await app.inject({ method: 'POST', url: '/api/v1/registry/reload' });
    expect(reload.json()).toMatchObject({ passports: 0, servers: 1, boundaries: 1 });
    expect((await decideCall()).json()).toMatchObject({ decision: 'deny', reasons: ['unknown_agent'] });
    const health = (await app.inject({ method: 'GET', url: '/api/v1/health' })).json();
    expect(health.registry_errors).toHaveLength(1);
  });
});
