import type { CedarInput } from './cedar-engine.js';
import { boundaryKey, type Registry } from './registry.js';
import type { Boundary, Category, DecideRequest, McpOperation, McpServerEntry, Passport } from './types.js';

export type UnresolvedReason = 'unknown_agent' | 'unknown_server' | 'unknown_operation' | 'boundary_missing';
export interface Resolved { ok: true; passport: Passport; server: McpServerEntry; operation: McpOperation; boundary: Boundary }
export interface Unresolved { ok: false; reason: UnresolvedReason }

const CATEGORIES: Category[] = ['read', 'write', 'decide', 'act', 'escalate'];

/** Find everything the decision needs, or name what is missing. */
export function resolve(reg: Registry, req: DecideRequest): Resolved | Unresolved {
  const passport = reg.passportsByPrincipal.get(req.agent_id);
  if (!passport) return { ok: false, reason: 'unknown_agent' };
  const server = reg.serversById.get(req.server_id);
  if (!server) return { ok: false, reason: 'unknown_server' };
  const operation = server.operations.find((o) => o.name === req.operation);
  if (!operation) return { ok: false, reason: 'unknown_operation' };
  const agentName = passport.agent_id.replace(/^agent:/, '');
  const boundary = reg.boundaries.get(boundaryKey(agentName, passport.permission_boundary_ref.version));
  if (!boundary) return { ok: false, reason: 'boundary_missing' };
  return { ok: true, passport, server, operation, boundary };
}

const scalar = (v: unknown): v is string | number => (typeof v === 'string' && v !== '') || typeof v === 'number';

/**
 * True when the agent acts for a user and every claim its passport names is
 * present and equals the named input argument. Only user-delegated agents can
 * satisfy an operation that requires user context.
 */
export function userClaimsMatch(passport: Passport, args: Record<string, unknown>, claims: Record<string, unknown>): boolean {
  if (passport.access.mode !== 'on_behalf_of_user') return false;
  const rules = passport.access.user_claims_in_policy ?? [];
  if (rules.length === 0) return false;
  return rules.every(({ claim, must_match_input }) => {
    const c = claims[claim];
    const a = args[must_match_input];
    return scalar(c) && scalar(a) && String(c) === String(a);
  });
}

export function toCedarInput(r: Resolved, req: DecideRequest, containmentLevel: number, today: string): CedarInput {
  const { passport, server, operation, boundary } = r;
  const action = operation.boundary_action ?? operation.name;
  const flatten = (list: 'allowed' | 'denied') =>
    CATEGORIES.flatMap((c) => boundary.permissions[c][list].map((a) => `${c}:${a}`));
  const serverOp = `${server.server_id}#${operation.name}`;
  return {
    agent: {
      id: passport.agent_id,
      attrs: {
        registration_status: passport.registration.status,
        containment_level: containmentLevel,
        allowed_operations: (passport.mcp_servers ?? []).flatMap((s) => s.allowed_operations.map((op) => `${s.server_id}#${op}`)),
        boundary_allowed: flatten('allowed'),
        boundary_denied: flatten('denied'),
        unattended_categories: CATEGORIES.filter((c) => boundary.oversight[c] === 'hotl' || boundary.oversight[c] === 'hota'),
      },
    },
    operation: {
      id: serverOp,
      attrs: {
        server_op: serverOp,
        access: operation.access,
        boundary_key: `${operation.access}:${action}`,
        description_sha256: operation.description_sha256,
        requires_user_context: operation.requires_user_context,
        server_status: server.registration.status,
        server_pinned_version: server.version,
      },
    },
    context: {
      observed_server_version: req.server_version,
      observed_description_sha256: req.observed_description_sha256,
      // No review date is treated as overdue: an approval without one is incomplete.
      review_overdue: !passport.registration.review_due || passport.registration.review_due < today,
      user_claims_match: userClaimsMatch(passport, req.arguments, req.user_claims),
    },
  };
}
