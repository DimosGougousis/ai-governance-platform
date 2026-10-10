import { performance } from 'node:perf_hooks';
import { nanoid } from 'nanoid';
import type { CedarEngine, CedarEvaluation } from './cedar-engine.js';
import { canonicalJson, sha256Hex } from './canonical-json.js';
import { resolve, toCedarInput, type Resolved, type Unresolved } from './entities.js';
import type { Registry } from './registry.js';
import type { StateStore } from './state-store.js';
import type { DecideRequest, DecideResponse, Outcome } from './types.js';

export interface DecideDeps {
  getRegistry(): Registry;
  engine: Pick<CedarEngine, 'evaluate' | 'policySha256'>;
  store: StateStore;
  now(): Date;
}

interface Verdict {
  decision: Outcome;
  reasons: string[];
  enforced: boolean;
  approvalId: string | null;
  platformAgentId: string | null;
  containmentLevel: number | null;
}

/** Steps 1-8 of spec Section 2. Every early return is a denial that names its reason. */
async function evaluate(
  deps: DecideDeps, req: DecideRequest, resolved: Resolved | Unresolved,
  decisionId: string, argsSha256: string, now: Date,
): Promise<Verdict> {
  const deny = (reasons: string[], seen: Partial<Verdict> = {}): Verdict =>
    ({ decision: 'deny', reasons, enforced: true, approvalId: null, platformAgentId: null, containmentLevel: null, ...seen });

  if (!resolved.ok) return deny([resolved.reason]);
  let agent: { id: string; containmentLevel: number } | null;
  try {
    agent = await deps.store.getAgent(req.agent_id);
  } catch {
    return deny(['state_unavailable']);
  }
  if (!agent) return deny(['containment_unknown']);
  const seen = { platformAgentId: agent.id, containmentLevel: agent.containmentLevel };

  let result: CedarEvaluation;
  try {
    result = deps.engine.evaluate(toCedarInput(resolved, req, agent.containmentLevel, now.toISOString().slice(0, 10)));
  } catch {
    return deny(['policy_error'], seen);
  }

  // From here the decision is a policy decision, so log-only mode applies.
  const enforced = resolved.passport.enforcement.mode === 'enforce';
  const verdict = (decision: Outcome, reasons: string[], approvalId: string | null = null): Verdict =>
    ({ decision, reasons, enforced, approvalId, ...seen });

  if (!result.invoke.allowed) return verdict('deny', result.invoke.reasons);
  if (result.unattended.allowed) return verdict('allow', result.unattended.reasons);

  const key = { agent_id: req.agent_id, server_id: req.server_id, operation: req.operation, args_sha256: argsSha256 };
  try {
    const consumed = await deps.store.consumeApproval(key, decisionId, now);
    if (consumed) return verdict('allow', ['approved-ticket'], consumed);
    const pending = await deps.store.findOrCreatePending(key, now);
    return verdict('escalate', result.unattended.reasons, pending.id);
  } catch {
    return deny(['state_unavailable'], seen);
  }
}

/**
 * Decide one tool call (spec Section 2). First deny wins; anything that cannot
 * be verified is denied and enforced, whatever the passport's enforcement mode.
 */
export async function decide(deps: DecideDeps, req: DecideRequest): Promise<DecideResponse> {
  const started = performance.now();
  const now = deps.now();
  const decisionId = `dec_${nanoid()}`;
  const argsSha256 = sha256Hex(canonicalJson(req.arguments ?? {}));
  const resolved = resolve(deps.getRegistry(), req);
  const v = await evaluate(deps, req, resolved, decisionId, argsSha256, now);

  const boundaryVersion = resolved.ok ? resolved.boundary.boundary_version : null;
  const response: DecideResponse = {
    decision_id: decisionId,
    decision: v.decision,
    enforced: v.enforced,
    reasons: v.reasons,
    ...(v.decision === 'escalate' && v.approvalId ? { approval_id: v.approvalId } : {}),
    policy_sha256: deps.engine.policySha256,
    boundary_version: boundaryVersion,
  };

  const { arguments: _args, user_claims, ...rest } = req;
  try {
    await deps.store.recordDecision({
      decision_id: decisionId,
      request: { ...rest, user_claim_keys: Object.keys(user_claims ?? {}).sort() },
      args_sha256: argsSha256,
      decision: v.decision,
      enforced: v.enforced,
      reasons: v.reasons,
      policy_sha256: deps.engine.policySha256,
      boundary_version: boundaryVersion,
      containment_level: v.containmentLevel,
      platform_agent_id: v.platformAgentId,
      approval_id: v.approvalId,
      latency_ms: performance.now() - started,
      decided_at: now,
    });
  } catch {
    // A decision that cannot be audited is not made (SAFEST A-11).
    return { decision_id: decisionId, decision: 'deny', enforced: true, reasons: ['audit_unavailable'], policy_sha256: deps.engine.policySha256, boundary_version: boundaryVersion };
  }
  return response;
}
