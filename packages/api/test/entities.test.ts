import { describe, expect, test } from 'vitest';
import { resolve, toCedarInput, userClaimsMatch } from '../src/enforcement/entities.js';
import { loadRegistry } from '../src/enforcement/registry.js';
import type { DecideRequest, Passport } from '../src/enforcement/types.js';
import { FINLEY, REGISTRY_DIR, SCHEMA_DIR, SERVER, TX_SHA, copyRegistry } from './helpers.js';

const reg = loadRegistry(REGISTRY_DIR, SCHEMA_DIR);
const request = (o: Partial<DecideRequest> = {}): DecideRequest => ({
  agent_id: FINLEY, server_id: SERVER, server_version: '1.4.2', operation: 'get_transactions',
  arguments: { customer_id: 'C-1001' }, observed_description_sha256: TX_SHA,
  user_claims: { customer_id: 'C-1001' }, ...o,
});

describe('resolve', () => {
  test.each([
    ['unknown_agent', request({ agent_id: 'spiffe://bank.example/agent/nobody' })],
    ['unknown_server', request({ server_id: 'mcp:nowhere-prod' })],
    ['unknown_operation', request({ operation: 'delete_everything' })],
  ])('%s', (reason, req) => {
    expect(resolve(reg, req)).toEqual({ ok: false, reason });
  });

  test('boundary_missing when no boundary matches the passport reference', () => {
    const dir = copyRegistry((f) => { f.boundary = f.boundary.replace('boundary_version: "1.0.0"', 'boundary_version: "2.0.0"'); });
    expect(resolve(loadRegistry(dir, SCHEMA_DIR), request())).toEqual({ ok: false, reason: 'boundary_missing' });
  });
});

describe('toCedarInput', () => {
  const r = resolve(reg, request());
  if (!r.ok) throw new Error('Finley should resolve');

  test("flattens Finley's passport, register and boundary", () => {
    const input = toCedarInput(r, request(), 0, '2026-02-01');
    expect(input.agent.id).toBe('agent:finley-prod-01');
    expect(input.agent.attrs.allowed_operations).toEqual([`${SERVER}#get_transactions`, `${SERVER}#get_savings_goals`]);
    expect(input.agent.attrs.boundary_allowed).toContain('read:customer_transaction_history');
    expect(input.agent.attrs.boundary_denied).toContain('act:payments');
    expect(input.agent.attrs.unattended_categories).toEqual(['read', 'write', 'decide', 'escalate']);
    expect(input.operation.attrs).toMatchObject({
      server_op: `${SERVER}#get_transactions`, access: 'read',
      boundary_key: 'read:customer_transaction_history', server_pinned_version: '1.4.2', server_status: 'approved',
    });
    expect(input.context).toEqual({
      observed_server_version: '1.4.2', observed_description_sha256: TX_SHA, review_overdue: false, user_claims_match: true,
    });
  });

  test('review is overdue only after the due date', () => {
    expect(toCedarInput(r, request(), 0, '2026-07-16').context.review_overdue).toBe(false);
    expect(toCedarInput(r, request(), 0, '2026-07-17').context.review_overdue).toBe(true);
  });

  test('an operation without boundary_action uses its name', () => {
    const op = { ...r.operation, boundary_action: undefined };
    expect(toCedarInput({ ...r, operation: op }, request(), 0, '2026-02-01').operation.attrs.boundary_key).toBe('read:get_transactions');
  });
});

describe('userClaimsMatch', () => {
  const r = resolve(reg, request());
  if (!r.ok) throw new Error('Finley should resolve');
  const p = r.passport;
  test('matching claim', () => expect(userClaimsMatch(p, { customer_id: 'C-1001' }, { customer_id: 'C-1001' })).toBe(true));
  test('another customer', () => expect(userClaimsMatch(p, { customer_id: 'C-2002' }, { customer_id: 'C-1001' })).toBe(false));
  test('no claims', () => expect(userClaimsMatch(p, { customer_id: 'C-1001' }, {})).toBe(false));
  test('argument missing', () => expect(userClaimsMatch(p, {}, { customer_id: 'C-1001' })).toBe(false));
  test('claim is an object', () => expect(userClaimsMatch(p, { customer_id: '[object Object]' }, { customer_id: {} })).toBe(false));
  test('an autonomous agent never satisfies a user-context operation', () => {
    const autonomous: Passport = { ...p, access: { mode: 'autonomous' } };
    expect(userClaimsMatch(autonomous, { customer_id: 'C-1001' }, { customer_id: 'C-1001' })).toBe(false);
  });
});
