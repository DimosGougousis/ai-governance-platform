import { and, desc, eq, lte, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { nanoid } from 'nanoid';
import * as schema from '../db/schema.js';
import { APPROVAL_TTL_MS, type Approval, type ApprovalKey, type ApprovalStatus, type DecisionRecord, type StateStore } from './state-store.js';

const t = schema.toolCallApprovals;
type Row = typeof t.$inferSelect;

const toApproval = (r: Row): Approval => ({
  id: r.id, agent_id: r.agentId, server_id: r.serverId, operation: r.operation, args_sha256: r.argsSha256,
  status: r.status, requested_at: r.requestedAt, decided_at: r.decidedAt, decided_by: r.decidedBy,
  decided_role: r.decidedRole, expires_at: r.expiresAt, consumed_at: r.consumedAt, consumed_by_decision_id: r.consumedByDecisionId,
});

const sameCall = (k: ApprovalKey) =>
  and(eq(t.agentId, k.agent_id), eq(t.serverId, k.server_id), eq(t.operation, k.operation), eq(t.argsSha256, k.args_sha256));

export class PgStateStore implements StateStore {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async getAgent(spiffeId: string) {
    const [row] = await this.db
      .select({ id: schema.agents.id, containmentLevel: schema.agents.currentContainmentLevel })
      .from(schema.agents).where(eq(schema.agents.spiffeId, spiffeId)).limit(1);
    return row ?? null;
  }

  async consumeApproval(k: ApprovalKey, decisionId: string, now: Date) {
    // One ticket, once: the row is locked, and the outer status check means a
    // second concurrent retry finds nothing to consume. Raw sql`` bypasses
    // drizzle's column mapping, so the timestamp is bound as an ISO string.
    const at = now.toISOString();
    const rows = await this.db.execute<{ id: string }>(sql`
      UPDATE tool_call_approvals
         SET status = 'consumed', consumed_at = ${at}, consumed_by_decision_id = ${decisionId}
       WHERE id = (
         SELECT id FROM tool_call_approvals
          WHERE agent_id = ${k.agent_id} AND server_id = ${k.server_id} AND operation = ${k.operation}
            AND args_sha256 = ${k.args_sha256} AND status = 'approved' AND expires_at > ${at}
          ORDER BY decided_at
          LIMIT 1
          FOR UPDATE SKIP LOCKED)
         AND status = 'approved'
      RETURNING id`);
    return rows[0]?.id ?? null;
  }

  async releaseApproval(id: string, decisionId: string) {
    // Only the decision that consumed the ticket may give it back; expires_at is kept.
    await this.db.update(t)
      .set({ status: 'approved', consumedAt: null, consumedByDecisionId: null })
      .where(and(eq(t.id, id), eq(t.status, 'consumed'), eq(t.consumedByDecisionId, decisionId)));
  }

  async findOrCreatePending(k: ApprovalKey, now: Date) {
    const existing = async () =>
      (await this.db.select().from(t).where(and(sameCall(k), eq(t.status, 'pending'))).limit(1))[0];
    const found = await existing();
    if (found) return toApproval(found);
    try {
      const [row] = await this.db.insert(t).values({
        id: `apr_${nanoid()}`, agentId: k.agent_id, serverId: k.server_id, operation: k.operation,
        argsSha256: k.args_sha256, status: 'pending', requestedAt: now,
      }).returning();
      return toApproval(row);
    } catch (e) {
      // A concurrent escalation created it first (unique pending index).
      if ((e as { code?: string }).code === '23505') {
        const raced = await existing();
        if (raced) return toApproval(raced);
      }
      throw e;
    }
  }

  async listApprovals(status: ApprovalStatus | undefined, now: Date) {
    await this.db.update(t).set({ status: 'expired' }).where(and(eq(t.status, 'approved'), lte(t.expiresAt, now)));
    const rows = await this.db.select().from(t)
      .where(status ? eq(t.status, status) : undefined)
      .orderBy(desc(t.requestedAt));
    return rows.map(toApproval);
  }

  async decideApproval(id: string, verdict: 'approved' | 'rejected', by: string, role: string, now: Date) {
    const [row] = await this.db.update(t).set({
      status: verdict, decidedAt: now, decidedBy: by, decidedRole: role,
      expiresAt: verdict === 'approved' ? new Date(now.getTime() + APPROVAL_TTL_MS) : null,
    }).where(and(eq(t.id, id), eq(t.status, 'pending'))).returning();
    if (row) return toApproval(row);
    const [exists] = await this.db.select({ id: t.id }).from(t).where(eq(t.id, id));
    return exists ? ('conflict' as const) : null;
  }

  async recordDecision(r: DecisionRecord) {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.policyDecisions).values({
        id: r.decision_id, agentId: r.request.agent_id, platformAgentId: r.platform_agent_id,
        serverId: r.request.server_id, operation: r.request.operation, argsSha256: r.args_sha256,
        request: r.request, outcome: r.decision, enforced: r.enforced, reasons: r.reasons,
        policySha256: r.policy_sha256, boundaryVersion: r.boundary_version, containmentLevel: r.containment_level,
        approvalId: r.approval_id, latencyMs: r.latency_ms, decidedAt: r.decided_at,
      });
      if (r.platform_agent_id) {
        const blocked = r.enforced && r.decision !== 'allow';
        await tx.insert(schema.guardrailEvents).values({
          agentId: r.platform_agent_id,
          timestamp: r.decided_at,
          railType: 'tool_call_policy',
          action: blocked ? 'block' : 'allow',
          triggerReason: `${r.enforced ? '' : 'log_only, not enforced: '}${r.decision}: ${r.reasons.join(', ')}`,
          inputHash: r.args_sha256,
          containmentLevel: r.containment_level,
          escalationTrigger: r.decision === 'escalate' ? 'hitl' : null,
        });
      }
    });
  }
}
