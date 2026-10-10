import type { DecideRequest, Outcome } from './types.js';

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'consumed', 'expired'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const APPROVAL_TTL_MS = 15 * 60 * 1000;

/** One exact tool call: an approval allows only this. */
export interface ApprovalKey { agent_id: string; server_id: string; operation: string; args_sha256: string }

export interface Approval extends ApprovalKey {
  id: string;
  status: ApprovalStatus;
  requested_at: Date;
  decided_at: Date | null;
  decided_by: string | null;
  decided_role: string | null;
  expires_at: Date | null;
  consumed_at: Date | null;
  consumed_by_decision_id: string | null;
}

/** The audit record of one decision. Argument and claim values are not kept. */
export interface DecisionRecord {
  decision_id: string;
  request: Omit<DecideRequest, 'arguments' | 'user_claims'> & { user_claim_keys: string[] };
  args_sha256: string;
  decision: Outcome;
  enforced: boolean;
  reasons: string[];
  policy_sha256: string;
  boundary_version: string | null;
  containment_level: number | null;
  platform_agent_id: string | null;
  approval_id: string | null;
  latency_ms: number;
  decided_at: Date;
}

export interface StateStore {
  /** The platform's agents row for this SPIFFE ID, or null. */
  getAgent(spiffeId: string): Promise<{ id: string; containmentLevel: number } | null>;
  /** Atomically consume an approved, unexpired ticket for this exact call. */
  consumeApproval(key: ApprovalKey, decisionId: string, now: Date): Promise<string | null>;
  /** The pending ticket for this exact call, created if none is pending. */
  findOrCreatePending(key: ApprovalKey, now: Date): Promise<Approval>;
  /** Marks lapsed approvals expired, then lists (optionally by status), newest first. */
  listApprovals(status: ApprovalStatus | undefined, now: Date): Promise<Approval[]>;
  /** pending -> approved | rejected. null: no such ticket; 'conflict': not pending. */
  decideApproval(id: string, verdict: 'approved' | 'rejected', by: string, role: string, now: Date): Promise<Approval | null | 'conflict'>;
  /** Writes the audit record (and the C6 guardrail event where an agents row exists). */
  recordDecision(record: DecisionRecord): Promise<void>;
}
