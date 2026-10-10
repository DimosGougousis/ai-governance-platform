import { describe, expect, test } from 'vitest';
import { loadCedarEngine } from '../src/enforcement/cedar-engine.js';
import { decide, type DecideDeps } from '../src/enforcement/decide.js';
import { MemoryStateStore } from '../src/enforcement/memory-state-store.js';
import { loadRegistry } from '../src/enforcement/registry.js';
import type { DecideRequest } from '../src/enforcement/types.js';
import { CEDAR_DIR, FINLEY, FIXED_NOW, SCHEMA_DIR, SERVER, TX_SHA, copyRegistry } from './helpers.js';

function hitlWorld() {
  const registry = loadRegistry(copyRegistry((f) => { f.boundary = f.boundary.replace(/read: hota/, 'read: hitl'); }), SCHEMA_DIR);
  const store = new MemoryStateStore();
  store.setAgent(FINLEY, 0);
  let now = FIXED_NOW;
  const d: DecideDeps = { getRegistry: () => registry, engine: loadCedarEngine(CEDAR_DIR), store, now: () => now };
  return { d, store, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

const request = (args: Record<string, unknown> = { customer_id: 'C-1001', from: '2026-01-01' }): DecideRequest => ({
  agent_id: FINLEY, server_id: SERVER, server_version: '1.4.2', operation: 'get_transactions',
  arguments: args, observed_description_sha256: TX_SHA, user_claims: { customer_id: 'C-1001' },
});

const approve = (w: ReturnType<typeof hitlWorld>, id: string) =>
  w.store.decideApproval(id, 'approved', 'M. de Boer', 'Customer Advisor', w.d.now());

describe('approval tickets', () => {
  test('a repeated escalation reuses the pending ticket', async () => {
    const w = hitlWorld();
    const a = await decide(w.d, request());
    const b = await decide(w.d, request());
    expect(b.approval_id).toBe(a.approval_id);
    expect(w.store.approvals.size).toBe(1);
  });

  test('an approved ticket allows exactly one retry', async () => {
    const w = hitlWorld();
    const first = await decide(w.d, request());
    await approve(w, first.approval_id!);
    const retry = await decide(w.d, request());
    expect(retry).toMatchObject({ decision: 'allow', reasons: ['approved-ticket'] });
    expect(w.store.approvals.get(first.approval_id!)?.status).toBe('consumed');
    const again = await decide(w.d, request());
    expect(again.decision).toBe('escalate');
    expect(again.approval_id).not.toBe(first.approval_id);
  });

  test('a retry with reordered argument keys uses the approval', async () => {
    const w = hitlWorld();
    const first = await decide(w.d, request({ customer_id: 'C-1001', from: '2026-01-01' }));
    await approve(w, first.approval_id!);
    expect((await decide(w.d, request({ from: '2026-01-01', customer_id: 'C-1001' }))).decision).toBe('allow');
  });

  test('a retry with different arguments does not use the approval', async () => {
    const w = hitlWorld();
    const first = await decide(w.d, request());
    await approve(w, first.approval_id!);
    const other = await decide(w.d, request({ customer_id: 'C-1001', from: '2025-01-01' }));
    expect(other.decision).toBe('escalate');
    expect(w.store.approvals.get(first.approval_id!)?.status).toBe('approved');
  });

  test('after a rejection the same call escalates with a fresh ticket', async () => {
    const w = hitlWorld();
    const first = await decide(w.d, request());
    await w.store.decideApproval(first.approval_id!, 'rejected', 'M. de Boer', 'Customer Advisor', w.d.now());
    const again = await decide(w.d, request());
    expect(again.decision).toBe('escalate');
    expect(again.approval_id).not.toBe(first.approval_id);
  });

  test('an approval expires after 15 minutes', async () => {
    const w = hitlWorld();
    const first = await decide(w.d, request());
    await approve(w, first.approval_id!);
    w.advance(15 * 60 * 1000 + 1);
    expect((await decide(w.d, request())).decision).toBe('escalate');
    expect((await w.store.listApprovals('expired', w.d.now())).map((a) => a.id)).toEqual([first.approval_id]);
  });

  test('only a pending ticket can be decided', async () => {
    const w = hitlWorld();
    const first = await decide(w.d, request());
    await approve(w, first.approval_id!);
    expect(await approve(w, first.approval_id!)).toBe('conflict');
    expect(await approve(w, 'apr_missing')).toBeNull();
  });
});
