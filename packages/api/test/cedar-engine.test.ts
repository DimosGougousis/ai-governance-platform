import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createCedarEngine, loadCedarEngine, type CedarInput } from '../src/enforcement/cedar-engine.js';

const cedarDir = path.resolve(__dirname, '../governance/cedar');

function input(agent: Record<string, unknown> = {}, op: Record<string, unknown> = {}, ctx: Record<string, unknown> = {}): CedarInput {
  return {
    agent: { id: 'agent:a', attrs: {
      registration_status: 'approved', containment_level: 0,
      allowed_operations: ['s#o'], boundary_allowed: ['read:x', 'write:y'], boundary_denied: ['read:bad'],
      unattended_categories: ['read'], ...agent,
    } as never },
    operation: { id: 's#o', attrs: {
      server_op: 's#o', access: 'read', boundary_key: 'read:x', description_sha256: 'h',
      requires_user_context: true, server_status: 'approved', server_pinned_version: '1', ...op,
    } as never },
    context: { observed_server_version: '1', observed_description_sha256: 'h', review_overdue: false, user_claims_match: true, ...ctx } as never,
  };
}

describe('the vendored Cedar policy', () => {
  const engine = loadCedarEngine(cedarDir);

  test('loads all 14 policies under their @id names', () => {
    expect(engine.policyCount).toBe(14);
    expect(engine.policySha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('a fully permitted call is allowed unattended', () => {
    const r = engine.evaluate(input());
    expect(r.invoke).toEqual({ allowed: true, reasons: ['permit-invoke'] });
    expect(r.unattended).toEqual({ allowed: true, reasons: ['permit-invoke-unattended'] });
  });

  test('a call in a hitl category is allowed but not unattended', () => {
    const r = engine.evaluate(input({}, { access: 'write', boundary_key: 'write:y' }));
    expect(r.invoke.allowed).toBe(true);
    expect(r.unattended).toEqual({ allowed: false, reasons: ['forbid-unattended-hitl'] });
  });

  test.each([
    ['forbid-containment-isolation', input({ containment_level: 4 })],
    ['forbid-containment-declawed', input({ containment_level: 3 }, { access: 'write', boundary_key: 'write:y' })],
    ['forbid-passport-not-approved', input({ registration_status: 'suspended' })],
    ['forbid-review-overdue', input({}, {}, { review_overdue: true })],
    ['forbid-server-not-approved', input({}, { server_status: 'suspended' })],
    ['forbid-server-version-drift', input({}, {}, { observed_server_version: '2' })],
    ['forbid-description-mismatch', input({}, {}, { observed_description_sha256: 'other' })],
    ['forbid-operation-not-in-passport', input({ allowed_operations: [] })],
    ['forbid-user-claims-mismatch', input({}, {}, { user_claims_match: false })],
    ['forbid-boundary-denied', input({}, { boundary_key: 'read:bad' })],
    ['forbid-boundary-unlisted', input({}, { boundary_key: 'read:nowhere' })],
  ])('%s denies the call', (id, call) => {
    const r = engine.evaluate(call);
    expect(r.invoke.allowed).toBe(false);
    expect(r.invoke.reasons).toContain(id);
  });

  test('containment level 3 still allows reads', () => {
    expect(engine.evaluate(input({ containment_level: 3 })).invoke.allowed).toBe(true);
  });

  test('the policy hash ignores line endings', () => {
    const policy = fs.readFileSync(path.join(cedarDir, 'tool-call.cedar'), 'utf8').replace(/\r\n/g, '\n');
    const schema = fs.readFileSync(path.join(cedarDir, 'schema.cedarschema'), 'utf8');
    expect(createCedarEngine(policy.replace(/\n/g, '\r\n'), schema).policySha256)
      .toBe(createCedarEngine(policy, schema).policySha256);
  });
});

describe('a malformed policy set is refused at load', () => {
  const schema = 'namespace Governance { entity Agent; entity Operation; action invoke appliesTo { principal: [Agent], resource: [Operation] }; }';
  test('a policy without @id', () => {
    expect(() => createCedarEngine('permit (principal, action, resource);', schema)).toThrow(/@id/);
  });
  test('a duplicate @id', () => {
    const p = '@id("a")\npermit (principal, action, resource);\n@id("a")\nforbid (principal, action, resource);';
    expect(() => createCedarEngine(p, schema)).toThrow(/Duplicate/);
  });
  test('a policy that does not parse', () => {
    expect(() => createCedarEngine('@id("a")\npermit (principal, action, resource', schema)).toThrow(/parse/);
  });
  test('a policy that fails schema validation', () => {
    const p = '@id("a")\npermit (principal, action, resource) when { principal.nope == 1 };';
    expect(() => createCedarEngine(p, schema)).toThrow(/validation/);
  });
});
