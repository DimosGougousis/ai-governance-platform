import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GOVERNANCE_DIR = path.resolve(__dirname, '../governance');
export const SCHEMA_DIR = path.join(GOVERNANCE_DIR, 'schemas');
export const REGISTRY_DIR = path.join(GOVERNANCE_DIR, 'registry');
export const CEDAR_DIR = path.join(GOVERNANCE_DIR, 'cedar');

export const FINLEY = 'spiffe://bank.example/agent/finley-prod-01';
export const SERVER = 'mcp:customer-data-prod';
export const TX_SHA = '0b0c7a11f2877cea1ed2817698e4b00700e4003553bb4e746046c2b1df1abd9b';
export const SG_SHA = '1e8d81d8e6f7a9302d95adb98bd35da93425ce3f2b803c1009d8ec9ef43cb413';
export const FIXED_NOW = new Date('2026-02-01T10:00:00Z');

export interface RegistryFiles { passport: string; server: string; boundary: string }

/** Copy Finley's vendored registry to a temp dir, optionally editing the YAML text first. */
export function copyRegistry(edit?: (files: RegistryFiles) => void): string {
  const read = (p: string) => fs.readFileSync(path.join(REGISTRY_DIR, p), 'utf8');
  const files: RegistryFiles = {
    passport: read('passports/finley.yaml'),
    server: read('mcp-servers/customer-data.yaml'),
    boundary: read('boundaries/finley.yaml'),
  };
  edit?.(files);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-'));
  for (const [sub, name, text] of [
    ['passports', 'finley.yaml', files.passport],
    ['mcp-servers', 'customer-data.yaml', files.server],
    ['boundaries', 'finley.yaml', files.boundary],
  ] as const) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    fs.writeFileSync(path.join(dir, sub, name), text, 'utf8');
  }
  return dir;
}
