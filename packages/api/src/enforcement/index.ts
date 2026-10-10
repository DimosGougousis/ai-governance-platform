import { loadCedarEngine } from './cedar-engine.js';
import { loadRegistry } from './registry.js';
import type { EnforcementDeps } from './routes.js';
import type { StateStore } from './state-store.js';

export { enforcementRoutes, type EnforcementDeps } from './routes.js';
export { MemoryStateStore } from './memory-state-store.js';

export interface EnforcementConfig {
  registryDir: string;
  schemaDir: string;
  cedarDir: string;
  store: StateStore;
  now?: () => Date;
}

/** Load the Cedar policy (throws if it is invalid) and the registry. */
export function createEnforcement(cfg: EnforcementConfig): EnforcementDeps {
  const engine = loadCedarEngine(cfg.cedarDir);
  let registry = loadRegistry(cfg.registryDir, cfg.schemaDir);
  return {
    engine,
    store: cfg.store,
    now: cfg.now ?? (() => new Date()),
    getRegistry: () => registry,
    reloadRegistry: () => (registry = loadRegistry(cfg.registryDir, cfg.schemaDir)),
  };
}
