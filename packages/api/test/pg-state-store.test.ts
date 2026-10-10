import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema.js';
import { PgStateStore } from '../src/enforcement/pg-state-store.js';
import type { DecisionRecord } from '../src/enforcement/state-store.js';
import { FINLEY, FIXED_NOW, SERVER } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PgStateStore against Postgres (layer B)', () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let store: PgStateStore;
  let agentRowId: string;
  const key = { agent_id: FINLEY, server_id: SERVER, operation: 'get_transactions', args_sha256: 'a'.repeat(64) };

  beforeAll(async () => {
    client = postgres(url!, { max: 4, onnotice: () => {} });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: 'src/db/migrations' });
    store = new PgStateStore(db);
  });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE tool_call_approvals, policy_decisions, guardrail_events, agents CASCADE`);
    const [row] = await db.insert(schema.agents).values({
      agentName: 'Finley', agentType: 'advisory', version: '1.0.0', modelId: 'gpt-4o', modelVersion: '2026-02-15',
      owner: 'J. Pietersen', team: 'Digital Banking', spiffeId: FINLEY, currentContainmentLevel: 2,
    }).returning();
    agentRowId = row.id;
  });

  test('getAgent finds the containment level by SPIFFE ID', async () => {
    expect(await store.getAgent(FINLEY)).toEqual({ id: agentRowId, containmentLevel: 2 });
    expect(await store.getAgent('spiffe://nobody')).toBeNull();
  });

  test('concurrent escalations of one call share one pending ticket', async () => {
    const [a, b] = await Promise.all([store.findOrCreatePending(key, FIXED_NOW), store.findOrCreatePending(key, FIXED_NOW)]);
    expect(a.id).toBe(b.id);
  });

  test('two concurrent retries consume one approval exactly once', async () => {
    const pending = await store.findOrCreatePending(key, FIXED_NOW);
    await store.decideApproval(pending.id, 'approved', 'M. de Boer', 'Customer Advisor', FIXED_NOW);
    const results = await Promise.all([
      store.consumeApproval(key, 'dec_1', FIXED_NOW),
      store.consumeApproval(key, 'dec_2', FIXED_NOW),
    ]);
    expect(results.filter(Boolean)).toEqual([pending.id]);
  });

  test('releaseApproval returns a consumed ticket to approved, only for the consuming decision', async () => {
    const pending = await store.findOrCreatePending(key, FIXED_NOW);
    await store.decideApproval(pending.id, 'approved', 'M. de Boer', 'Customer Advisor', FIXED_NOW);
    expect(await store.consumeApproval(key, 'dec_1', FIXED_NOW)).toBe(pending.id);

    await store.releaseApproval(pending.id, 'dec_other');
    expect((await store.listApprovals('consumed', FIXED_NOW)).map((a) => a.id)).toEqual([pending.id]);
    expect(await store.consumeApproval(key, 'dec_2', FIXED_NOW)).toBeNull();

    await store.releaseApproval(pending.id, 'dec_1');
    const [released] = await store.listApprovals('approved', FIXED_NOW);
    expect(released).toMatchObject({ id: pending.id, status: 'approved', consumed_at: null, consumed_by_decision_id: null });
    expect(released.expires_at).not.toBeNull();
    expect(await store.consumeApproval(key, 'dec_3', FIXED_NOW)).toBe(pending.id);
    expect(await store.consumeApproval(key, 'dec_4', FIXED_NOW)).toBeNull();
  });

  test('decideApproval: conflict when not pending, null when missing; expiry is lazy', async () => {
    const pending = await store.findOrCreatePending(key, FIXED_NOW);
    const approved = await store.decideApproval(pending.id, 'approved', 'M. de Boer', 'Customer Advisor', FIXED_NOW);
    expect(approved).toMatchObject({ status: 'approved', decided_role: 'Customer Advisor' });
    expect(await store.decideApproval(pending.id, 'rejected', 'X', 'Y', FIXED_NOW)).toBe('conflict');
    expect(await store.decideApproval('apr_missing', 'approved', 'X', 'Y', FIXED_NOW)).toBeNull();
    const later = new Date(FIXED_NOW.getTime() + 16 * 60 * 1000);
    expect((await store.listApprovals('expired', later)).map((a) => a.id)).toEqual([pending.id]);
    expect(await store.consumeApproval(key, 'dec_3', later)).toBeNull();
  });

  test('recordDecision writes the audit row and a C6 guardrail event', async () => {
    const record: DecisionRecord = {
      decision_id: 'dec_test', request: { agent_id: FINLEY, server_id: SERVER, server_version: '1.4.2', operation: 'get_transactions', observed_description_sha256: 'h', user_claim_keys: ['customer_id'] },
      args_sha256: key.args_sha256, decision: 'escalate', enforced: true, reasons: ['forbid-unattended-hitl'],
      policy_sha256: 'p'.repeat(64), boundary_version: '1.0.0', containment_level: 2, platform_agent_id: agentRowId,
      approval_id: 'apr_x', latency_ms: 3.2, decided_at: FIXED_NOW,
    };
    await store.recordDecision(record);
    const [audit] = await db.select().from(schema.policyDecisions).where(eq(schema.policyDecisions.id, 'dec_test'));
    expect(audit).toMatchObject({ outcome: 'escalate', enforced: true, reasons: ['forbid-unattended-hitl'], approvalId: 'apr_x' });
    const [event] = await db.select().from(schema.guardrailEvents).where(eq(schema.guardrailEvents.agentId, agentRowId));
    expect(event).toMatchObject({ railType: 'tool_call_policy', action: 'block', escalationTrigger: 'hitl', inputHash: key.args_sha256, containmentLevel: 2 });
  });

  test('a decision with no agents row writes the audit row only', async () => {
    await store.recordDecision({
      decision_id: 'dec_unknown', request: { agent_id: 'spiffe://nobody', server_id: SERVER, server_version: '1', operation: 'x', observed_description_sha256: 'h', user_claim_keys: [] },
      args_sha256: key.args_sha256, decision: 'deny', enforced: true, reasons: ['unknown_agent'], policy_sha256: 'p'.repeat(64),
      boundary_version: null, containment_level: null, platform_agent_id: null, approval_id: null, latency_ms: 1, decided_at: FIXED_NOW,
    });
    expect(await db.select().from(schema.policyDecisions)).toHaveLength(1);
    expect(await db.select().from(schema.guardrailEvents)).toHaveLength(0);
  });
});
