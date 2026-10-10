import fs from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import type { Boundary, McpServerEntry, Passport } from './types.js';

export interface RegistryError { file: string; message: string }

export interface Registry {
  passportsByPrincipal: Map<string, Passport>;
  serversById: Map<string, McpServerEntry>;
  /** Keyed by boundaryKey(agent_name, boundary_version). */
  boundaries: Map<string, Boundary>;
  errors: RegistryError[];
}

export const boundaryKey = (agentName: string, version: string) => `${agentName}@${version}`;

const KINDS = [
  { dir: 'passports', schema: 'agent-passport-schema.yaml', key: (d: unknown) => (d as Passport).identity.principal_id },
  { dir: 'mcp-servers', schema: 'mcp-server-schema.yaml', key: (d: unknown) => (d as McpServerEntry).server_id },
  { dir: 'boundaries', schema: 'permission-boundary-schema.yaml', key: (d: unknown) => boundaryKey((d as Boundary).agent_name, (d as Boundary).boundary_version) },
] as const;

/**
 * Load and validate the governance registry. A file that fails to parse or
 * validate is reported and left out, so its agent or server is denied rather
 * than half-loaded. Two files claiming the same key are both left out.
 */
export function loadRegistry(registryDir: string, schemaDir: string): Registry {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const errors: RegistryError[] = [];
  const maps = KINDS.map((kind) => {
    const loaded = new Map<string, unknown>();
    const duplicated = new Set<string>();
    const validate = ajv.compile(parse(fs.readFileSync(path.join(schemaDir, kind.schema), 'utf8')));
    const dir = path.join(registryDir, kind.dir);
    if (!fs.existsSync(dir)) {
      errors.push({ file: dir, message: 'directory missing' });
      return loaded;
    }
    for (const name of fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).sort()) {
      const file = path.join(dir, name);
      let doc: unknown;
      try {
        doc = parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        errors.push({ file, message: `unparseable YAML: ${(e as Error).message}` });
        continue;
      }
      if (!validate(doc)) {
        errors.push({ file, message: ajv.errorsText(validate.errors) });
        continue;
      }
      const key = kind.key(doc);
      if (loaded.has(key) || duplicated.has(key)) {
        errors.push({ file, message: `duplicate ${kind.dir} key ${key}; every file claiming it is rejected` });
        duplicated.add(key);
        loaded.delete(key);
        continue;
      }
      loaded.set(key, doc);
    }
    return loaded;
  });
  return {
    passportsByPrincipal: maps[0] as Map<string, Passport>,
    serversById: maps[1] as Map<string, McpServerEntry>,
    boundaries: maps[2] as Map<string, Boundary>,
    errors,
  };
}
