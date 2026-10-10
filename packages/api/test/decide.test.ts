import { describe, expect, test } from 'vitest';
import { loadCedarEngine } from '../src/enforcement/cedar-engine.js';
import { decide, type DecideDeps } from '../src/enforcement/decide.js';
import { MemoryStateStore } from '../src/enforcement/memory-state-store.js';
import { loadRegistry } from '../src/enforcement/registry.js';
import type { DecideRequest } from '../src/enforcement/types.js';
import { CEDAR_DIR, FINLEY, FIXED_NOW, REGISTRY_DIR, SCHEMA_DIR, SERVER, SG_SHA, TX_SHA, copyRegistry, type RegistryFiles } from './helpers.js';

const engine = loadCedarEngine(CEDAR_DIR);

function deps(opts: { edit?: (f: RegistryFiles) => void; containment?: number | null; now?: Date } = {}) {
  const registry = loadRegistry(opts.edit ? copyRegistry(opts.edit) : REGISTRY_DIR, SCHEMA_DIR);
  const store = new MemoryStateStore();
  if (opts.containment !== null) store.setAgent(FINLEY, opts.containment ?? 0);
  const d: DecideDeps = { getRegistry: () => registry, engine, store, now: () => opts.now ?? FIXED_NOW };
  return { d, store };
}

const request = (o: Partial<DecideRequest> = {}): DecideRequest => ({
  agent_id: FINLEY, server_id: SERVER, server_version: '1.4.2', operation: 'get_transactions',
  arguments: { customer_id: 'C-1001', from: '2026-01-01' }, observed_description_sha256: TX_SHA,
  user_claims: { customer_id: 'C-1001' }, ...o,
});

// Edits to Finley's YAML for scenarios the real files do not cover.
const writeOperation = (f: RegistryFiles) => {
  f.server = f.server.replace(/access: read\n(\s+)boundary_action: "customer_transaction_history"/,
    'access: write\n$1boundary_action: "conversation_logs"');
};
const mapTransactionsTo = (action: string) => (f: RegistryFiles) => {
  f.server = f.server.replace('boundary_action: "customer_transaction_history"', `boundary_action: "${action}"`);
};

describe('decide -- Finley scenarios (layer A)', () => {
  test('get_transactions for the right customer is allowed', async () => {
    const { d, store } = deps();
    const r = await decide(d, request());
    expect(r).toMatchObject({ decision: 'allow', enforced: true, reasons: ['permit-invoke-unattended'], boundary_version: '1.0.0', policy_sha256: engine.policySha256 });
    expect(r.decision_id).toMatch(/^dec_/);
    expect(store.decisions).toHaveLength(1);
  });

  test('get_savings_goals is allowed through its boundary_action mapping', async () => {
    const { d } = deps();
    expect((await decide(d, request({ operation: 'get_savings_goals', observed_description_sha256: SG_SHA }))).decision).toBe('allow');
  });

  test.each([
    ['containment level 4', { containment: 4 }, request(), 'forbid-containment-isolation'],
    ['containment level 3, write operation', { containment: 3, edit: writeOperation }, request(), 'forbid-containment-declawed'],
    ['passport suspended', { edit: (f: RegistryFiles) => { f.passport = f.passport.replace('status: approved', 'status: suspended'); } }, request(), 'forbid-passport-not-approved'],
    ['review overdue', { now: new Date('2026-08-01T10:00:00Z') }, request(), 'forbid-review-overdue'],
    ['server suspended', { edit: (f: RegistryFiles) => { f.server = f.server.replace('status: approved', 'status: suspended'); } }, request(), 'forbid-server-not-approved'],
    ['server version drift', {}, request({ server_version: '1.5.0' }), 'forbid-server-version-drift'],
    ['description hash mismatch', {}, request({ observed_description_sha256: SG_SHA }), 'forbid-description-mismatch'],
    ['operation not in passport', { edit: (f: RegistryFiles) => { f.passport = f.passport.replace(/\n\s+- "get_transactions"/, ''); } }, request(), 'forbid-operation-not-in-passport'],
    ["another customer's id", {}, request({ arguments: { customer_id: 'C-2002' } }), 'forbid-user-claims-mismatch'],
    ['no user claims', {}, request({ user_claims: {} }), 'forbid-user-claims-mismatch'],
    ['boundary denied list', { edit: mapTransactionsTo('other_customers_data') }, request(), 'forbid-boundary-denied'],
    ['unlisted boundary action', { edit: mapTransactionsTo('modify_interest_rate') }, request(), 'forbid-boundary-unlisted'],
  ])('%s is denied', async (_name, opts, req, reason) => {
    const { d } = deps(opts as Parameters<typeof deps>[0]);
    const r = await decide(d, req);
    expect(r.decision).toBe('deny');
    expect(r.enforced).toBe(true);
    expect(r.reasons).toContain(reason);
  });

  test('containment level 3 still allows a read', async () => {
    const { d } = deps({ containment: 3 });
    expect((await decide(d, request())).decision).toBe('allow');
  });

  test('a hitl category escalates with an approval ticket', async () => {
    const { d } = deps({ edit: (f) => { f.boundary = f.boundary.replace(/read: hota/, 'read: hitl'); } });
    const r = await decide(d, request());
    expect(r).toMatchObject({ decision: 'escalate', enforced: true, reasons: ['forbid-unattended-hitl'] });
    expect(r.approval_id).toMatch(/^apr_/);
  });

  test('a log_only passport gets the real decision, not enforced', async () => {
    const { d } = deps({ edit: (f) => { f.passport = f.passport.replace('mode: enforce', 'mode: log_only'); } });
    const r = await decide(d, request({ observed_description_sha256: SG_SHA }));
    expect(r).toMatchObject({ decision: 'deny', enforced: false, reasons: ['forbid-description-mismatch'] });
  });
});

describe('decide -- verification failures always deny and are enforced', () => {
  const logOnly = (f: RegistryFiles) => { f.passport = f.passport.replace('mode: enforce', 'mode: log_only'); };

  test.each([
    ['unknown_agent', {}, request({ agent_id: 'spiffe://bank.example/agent/nobody' })],
    ['unknown_server', {}, request({ server_id: 'mcp:nowhere-prod' })],
    ['unknown_operation', {}, request({ operation: 'delete_everything' })],
    ['boundary_missing', { edit: (f: RegistryFiles) => { logOnly(f); f.boundary = f.boundary.replace('boundary_version: "1.0.0"', 'boundary_version: "2.0.0"'); } }, request()],
    ['containment_unknown', { containment: null, edit: logOnly }, request()],
  ])('%s', async (reason, opts, req) => {
    const { d } = deps(opts as Parameters<typeof deps>[0]);
    expect(await decide(d, req)).toMatchObject({ decision: 'deny', enforced: true, reasons: [reason] });
  });

  test('state_unavailable', async () => {
    const { d, store } = deps({ edit: logOnly });
    store.failState = true;
    expect(await decide(d, request())).toMatchObject({ decision: 'deny', enforced: true, reasons: ['state_unavailable'] });
  });

  test('policy_error', async () => {
    const { d } = deps({ edit: logOnly });
    const broken: DecideDeps = { ...d, engine: { policySha256: 'x', evaluate: () => { throw new Error('boom'); } } };
    expect(await decide(broken, request())).toMatchObject({ decision: 'deny', enforced: true, reasons: ['policy_error'] });
  });

  test('audit_unavailable', async () => {
    // The pre-audit verdict is an escalate with a ticket, so dropping approval_id is observable.
    const { d, store } = deps({ edit: (f) => { logOnly(f); f.boundary = f.boundary.replace(/read: hota/, 'read: hitl'); } });
    store.failRecord = true;
    const r = await decide(d, request());
    expect(r).toMatchObject({ decision: 'deny', enforced: true, reasons: ['audit_unavailable'] });
    expect(r.approval_id).toBeUndefined();
    expect(store.approvals.size).toBe(1);
  });

  test('state_unavailable from the approval path', async () => {
    const { d, store } = deps({ edit: (f) => { logOnly(f); f.boundary = f.boundary.replace(/read: hota/, 'read: hitl'); } });
    store.failApprovals = true;
    const r = await decide(d, request());
    expect(r).toMatchObject({ decision: 'deny', enforced: true, reasons: ['state_unavailable'] });
    expect(r.approval_id).toBeUndefined();
  });
});

describe('decide -- the audit record', () => {
  test('stores the argument hash and claim keys, not their values', async () => {
    const { d, store } = deps();
    await decide(d, request());
    const rec = store.decisions[0];
    expect(rec.args_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(rec.request).toEqual({ agent_id: FINLEY, server_id: SERVER, server_version: '1.4.2', operation: 'get_transactions', observed_description_sha256: TX_SHA, user_claim_keys: ['customer_id'] });
    expect(JSON.stringify(rec)).not.toContain('C-1001');
    expect(rec).toMatchObject({ decision: 'allow', enforced: true, containment_level: 0, boundary_version: '1.0.0' });
    expect(rec.platform_agent_id).toBeTruthy();
  });

  test('persists only the allowlisted request fields, whatever else the request carries', async () => {
    const { d, store } = deps();
    await decide(d, { ...request(), secret: 'leaky-value', nested: { token: 'tok' } } as unknown as DecideRequest);
    const rec = store.decisions[0];
    expect(Object.keys(rec.request).sort()).toEqual(['agent_id', 'observed_description_sha256', 'operation', 'server_id', 'server_version', 'user_claim_keys']);
    expect(JSON.stringify(rec)).not.toContain('leaky-value');
    expect(JSON.stringify(rec)).not.toContain('tok');
  });
});
