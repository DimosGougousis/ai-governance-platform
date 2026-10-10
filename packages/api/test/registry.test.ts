import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { boundaryKey, loadRegistry } from '../src/enforcement/registry.js';
import { FINLEY, REGISTRY_DIR, SCHEMA_DIR, SERVER, copyRegistry } from './helpers.js';

describe('loadRegistry', () => {
  test("loads Finley's passport, server and boundary", () => {
    const reg = loadRegistry(REGISTRY_DIR, SCHEMA_DIR);
    expect(reg.errors).toEqual([]);
    expect(reg.passportsByPrincipal.get(FINLEY)?.agent_id).toBe('agent:finley-prod-01');
    expect(reg.serversById.get(SERVER)?.operations.map((o) => o.boundary_action))
      .toEqual(['customer_transaction_history', 'customer_savings_goals']);
    expect(reg.boundaries.get(boundaryKey('finley-prod-01', '1.0.0'))?.oversight.read).toBe('hota');
  });

  test('a file that fails its schema is reported and not loaded', () => {
    const dir = copyRegistry((f) => { f.passport = f.passport.replace(/^purpose:/m, 'purpose_removed:'); });
    const reg = loadRegistry(dir, SCHEMA_DIR);
    expect(reg.passportsByPrincipal.size).toBe(0);
    expect(reg.errors).toHaveLength(1);
    expect(reg.errors[0].file).toMatch(/finley\.yaml$/);
  });

  test('unparseable YAML is reported and not loaded', () => {
    const dir = copyRegistry((f) => { f.server = 'server_id: [unclosed'; });
    const reg = loadRegistry(dir, SCHEMA_DIR);
    expect(reg.serversById.size).toBe(0);
    expect(reg.errors[0].message).toMatch(/unparseable YAML/);
  });

  test('duplicate principals are both rejected', () => {
    const dir = copyRegistry();
    fs.copyFileSync(path.join(dir, 'passports/finley.yaml'), path.join(dir, 'passports/finley-copy.yaml'));
    const reg = loadRegistry(dir, SCHEMA_DIR);
    expect(reg.passportsByPrincipal.has(FINLEY)).toBe(false);
    expect(reg.errors.map((e) => e.message).join()).toMatch(/duplicate/);
  });

  test('a missing directory is reported', () => {
    const dir = copyRegistry();
    fs.rmSync(path.join(dir, 'boundaries'), { recursive: true });
    const reg = loadRegistry(dir, SCHEMA_DIR);
    expect(reg.boundaries.size).toBe(0);
    expect(reg.errors[0].message).toBe('directory missing');
  });
});
