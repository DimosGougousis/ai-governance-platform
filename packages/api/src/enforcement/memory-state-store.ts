import { nanoid } from 'nanoid';
import { APPROVAL_TTL_MS, type Approval, type ApprovalKey, type ApprovalStatus, type DecisionRecord, type StateStore } from './state-store.js';

/** In-memory StateStore for tests and the end-to-end demo. */
export class MemoryStateStore implements StateStore {
  readonly agents = new Map<string, { id: string; containmentLevel: number }>();
  readonly approvals = new Map<string, Approval>();
  readonly decisions: DecisionRecord[] = [];
  /** Fault injection: state reads and writes throw. */
  failState = false;
  /** Fault injection: the audit write throws. */
  failRecord = false;

  setAgent(spiffeId: string, containmentLevel: number, id = `agent-${nanoid(8)}`): void {
    this.agents.set(spiffeId, { id, containmentLevel });
  }

  private guard(): void {
    if (this.failState) throw new Error('state store unavailable');
  }

  private static same(a: ApprovalKey, k: ApprovalKey): boolean {
    return a.agent_id === k.agent_id && a.server_id === k.server_id && a.operation === k.operation && a.args_sha256 === k.args_sha256;
  }

  async getAgent(spiffeId: string) {
    this.guard();
    return this.agents.get(spiffeId) ?? null;
  }

  async consumeApproval(key: ApprovalKey, decisionId: string, now: Date) {
    this.guard();
    for (const a of this.approvals.values()) {
      if (MemoryStateStore.same(a, key) && a.status === 'approved' && a.expires_at && a.expires_at > now) {
        a.status = 'consumed';
        a.consumed_at = now;
        a.consumed_by_decision_id = decisionId;
        return a.id;
      }
    }
    return null;
  }

  async findOrCreatePending(key: ApprovalKey, now: Date) {
    this.guard();
    for (const a of this.approvals.values()) if (MemoryStateStore.same(a, key) && a.status === 'pending') return a;
    const a: Approval = {
      id: `apr_${nanoid()}`, ...key, status: 'pending', requested_at: now, decided_at: null, decided_by: null,
      decided_role: null, expires_at: null, consumed_at: null, consumed_by_decision_id: null,
    };
    this.approvals.set(a.id, a);
    return a;
  }

  async listApprovals(status: ApprovalStatus | undefined, now: Date) {
    this.guard();
    for (const a of this.approvals.values()) {
      if (a.status === 'approved' && a.expires_at && a.expires_at <= now) a.status = 'expired';
    }
    return [...this.approvals.values()]
      .filter((a) => !status || a.status === status)
      .sort((x, y) => y.requested_at.getTime() - x.requested_at.getTime());
  }

  async decideApproval(id: string, verdict: 'approved' | 'rejected', by: string, role: string, now: Date) {
    this.guard();
    const a = this.approvals.get(id);
    if (!a) return null;
    if (a.status !== 'pending') return 'conflict' as const;
    a.status = verdict;
    a.decided_at = now;
    a.decided_by = by;
    a.decided_role = role;
    a.expires_at = verdict === 'approved' ? new Date(now.getTime() + APPROVAL_TTL_MS) : null;
    return a;
  }

  async recordDecision(record: DecisionRecord) {
    if (this.failRecord) throw new Error('audit store unavailable');
    this.decisions.push(record);
  }
}
