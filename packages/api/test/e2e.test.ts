import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { buildApp } from '../src/app.js';
import { createEnforcement, MemoryStateStore } from '../src/enforcement/index.js';
import { CEDAR_DIR, FINLEY, FIXED_NOW, SCHEMA_DIR, SERVER, copyRegistry } from './helpers.js';

const governanceRepo = process.env.GOVERNANCE_REPO_DIR;
const TOOLS = () => [
  { name: 'get_transactions', description: "Returns the authenticated customer's own transactions for a date range, categorised." },
  { name: 'get_savings_goals', description: "Returns the authenticated customer's own savings goals and progress." },
];

describe.skipIf(!governanceRepo)('gateway → PDP → upstream, end to end (layer D)', () => {
  // Loaded lazily: vitest still runs this callback to collect a skipped suite.
  const loadGateway = () => {
    const requireCjs = createRequire(import.meta.url);
    const gatewayDir = path.join(governanceRepo!, '05-cross-cutting/policy-as-code/gateway');
    return {
      ...requireCjs(path.join(gatewayDir, 'gateway.js')),
      ...requireCjs(path.join(gatewayDir, 'test-servers.js')),
    };
  };

  const cleanups: (() => Promise<unknown>)[] = [];
  afterEach(async () => { while (cleanups.length) await cleanups.pop()!(); });

  async function world({ hitl = false } = {}) {
    const { createGateway, startFakeUpstream, listen, closeServer, mcpPost } = loadGateway();
    const store = new MemoryStateStore();
    store.setAgent(FINLEY, 0);
    const registryDir = copyRegistry((f) => { if (hitl) f.boundary = f.boundary.replace(/read: hota/, 'read: hitl'); });
    const app = await buildApp(createEnforcement({ registryDir, schemaDir: SCHEMA_DIR, cedarDir: CEDAR_DIR, store, now: () => FIXED_NOW }), { logger: false });
    const pdpUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    cleanups.push(() => app.close());
    const upstream = await startFakeUpstream({ tools: TOOLS() });
    cleanups.push(() => upstream.close());
    const gw = createGateway({ agentId: FINLEY, pdpUrl, servers: { [SERVER]: upstream.url }, log: () => {} });
    const endpoint = `${await listen(gw)}/servers/${encodeURIComponent(SERVER)}`;
    cleanups.push(() => closeServer(gw));

    let id = 0;
    const post = (method: string, params?: object, headers: Record<string, string> = {}) =>
      mcpPost(endpoint, { jsonrpc: '2.0', id: ++id, method, ...(params ? { params } : {}) }, headers);
    const call = (name: string, customerInArgs: string, customerInClaims = 'C-1001') =>
      post('tools/call', { name, arguments: { customer_id: customerInArgs } },
        { 'x-governance-user-claims': Buffer.from(JSON.stringify({ customer_id: customerInClaims })).toString('base64url') });
    await post('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'finley', version: '1' } });
    await post('tools/list');
    return { app, store, upstream, post, call };
  }

  test('1. get_transactions for the customer in session is allowed and executed', async () => {
    const w = await world();
    const r = await w.call('get_transactions', 'C-1001');
    expect(r.json.result.content[0].text).toBe('called get_transactions');
    expect(w.upstream.toolCalls()).toHaveLength(1);
    expect(w.store.decisions.at(-1)).toMatchObject({ decision: 'allow', enforced: true });
  });

  test("2. another customer's transactions are denied and never reach the server", async () => {
    const w = await world();
    const r = await w.call('get_transactions', 'C-2002');
    expect(r.json.result.isError).toBe(true);
    expect(r.json.result.content[0].text).toContain('forbid-user-claims-mismatch');
    expect(w.upstream.toolCalls()).toHaveLength(0);
  });

  test('3. a server that swaps its tool description is denied', async () => {
    const w = await world();
    w.upstream.state.tools[0].description = "Returns any customer's transactions.";
    await w.post('tools/list'); // the agent now sees the new description
    const r = await w.call('get_transactions', 'C-1001');
    expect(r.json.result.content[0].text).toContain('forbid-description-mismatch');
    expect(w.upstream.toolCalls()).toHaveLength(0);
  });

  test('4. containment level 4 stops the very next call', async () => {
    const w = await world();
    expect((await w.call('get_transactions', 'C-1001')).json.result.isError).toBeUndefined();
    w.store.setAgent(FINLEY, 4);
    const r = await w.call('get_transactions', 'C-1001');
    expect(r.json.result.content[0].text).toContain('forbid-containment-isolation');
    expect(w.upstream.toolCalls()).toHaveLength(1);
  });

  test('5. a HITL call escalates, runs once after approval, then escalates again', async () => {
    const w = await world({ hitl: true });
    const first = await w.call('get_savings_goals', 'C-1001');
    const approvalId = first.json.result._meta.governance.approval_id;
    expect(first.json.result._meta.governance.decision).toBe('escalate');
    expect(approvalId).toMatch(/^apr_/);
    expect(w.upstream.toolCalls()).toHaveLength(0);

    const approved = await w.app.inject({ method: 'POST', url: `/api/v1/approvals/${approvalId}/approve`, payload: { approver_name: 'M. de Boer', approver_role: 'Customer Advisor' } });
    expect(approved.statusCode).toBe(200);

    const retry = await w.call('get_savings_goals', 'C-1001');
    expect(retry.json.result.content[0].text).toBe('called get_savings_goals');
    expect(w.upstream.toolCalls()).toHaveLength(1);

    const again = await w.call('get_savings_goals', 'C-1001');
    expect(again.json.result._meta.governance.decision).toBe('escalate');
    expect(again.json.result._meta.governance.approval_id).not.toBe(approvalId);
    expect(w.upstream.toolCalls()).toHaveLength(1);
  });
});
