import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as cedar from '@cedar-policy/cedar-wasm/nodejs';
import type { CedarValueJson } from '@cedar-policy/cedar-wasm/nodejs';

export type { CedarValueJson };

export interface CedarInput {
  agent: { id: string; attrs: Record<string, CedarValueJson> };
  operation: { id: string; attrs: Record<string, CedarValueJson> };
  context: Record<string, CedarValueJson>;
}
export interface CedarAnswer { allowed: boolean; reasons: string[] }
export interface CedarEvaluation { invoke: CedarAnswer; unattended: CedarAnswer }
export interface CedarEngine {
  policySha256: string;
  policyCount: number;
  evaluate(input: CedarInput): CedarEvaluation;
}

const messages = (errors: { message: string }[]) => errors.map((e) => e.message).join('; ');

/**
 * Cedar names policies policy0, policy1, ... when given one string, so the set
 * is split and re-keyed by each policy's @id. Those ids are the decision's
 * reasons.
 */
export function createCedarEngine(policyText: string, schemaText: string): CedarEngine {
  const text = policyText.replace(/\r\n/g, '\n');
  const parts = cedar.policySetTextToParts(text);
  if (parts.type !== 'success') throw new Error(`Cedar policy does not parse: ${messages(parts.errors)}`);

  // Templates would be silently ignored by the id re-keying below.
  if (parts.policy_templates.length > 0) {
    throw new Error('Cedar policy templates are not supported');
  }

  // A null-prototype object keeps every @id an own key, including "__proto__".
  const byId: Record<string, string> = Object.create(null);
  for (const policy of parts.policies) {
    const json = cedar.policyToJson(policy);
    if (json.type !== 'success') throw new Error(`Cedar policy does not parse: ${messages(json.errors)}`);
    const id = json.json.annotations?.id;
    if (!id) throw new Error(`Cedar policy has no @id annotation: ${policy.slice(0, 80)}`);
    if (Object.hasOwn(byId, id)) throw new Error(`Duplicate Cedar policy @id: ${id}`);
    Object.defineProperty(byId, id, { value: policy, enumerable: true, writable: true, configurable: true });
  }
  const policies = { staticPolicies: byId };

  const validation = cedar.validate({ schema: schemaText, policies, validationSettings: { mode: 'strict' } });
  if (validation.type !== 'success') throw new Error(`Cedar schema validation failed: ${messages(validation.errors)}`);
  if (validation.validationErrors.length > 0) {
    throw new Error(`Cedar schema validation failed: ${validation.validationErrors.map((e) => `${e.policyId}: ${e.error.message}`).join('; ')}`);
  }

  const policySha256 = createHash('sha256').update(text, 'utf8').digest('hex');

  function ask(action: 'invoke' | 'invoke_unattended', input: CedarInput): CedarAnswer {
    const answer = cedar.isAuthorized({
      principal: { type: 'Governance::Agent', id: input.agent.id },
      action: { type: 'Governance::Action', id: action },
      resource: { type: 'Governance::Operation', id: input.operation.id },
      context: input.context,
      schema: schemaText,
      validateRequest: true,
      policies,
      entities: [
        { uid: { type: 'Governance::Agent', id: input.agent.id }, attrs: input.agent.attrs, parents: [] },
        { uid: { type: 'Governance::Operation', id: input.operation.id }, attrs: input.operation.attrs, parents: [] },
      ],
    });
    if (answer.type !== 'success') throw new Error(`Cedar evaluation failed: ${messages(answer.errors)}`);
    const { decision, diagnostics } = answer.response;
    // A policy that errors is skipped by Cedar, which could turn a forbid into
    // an allow. Any error is therefore a failed evaluation.
    if (diagnostics.errors.length > 0) {
      throw new Error(`Cedar policy errored: ${diagnostics.errors.map((e) => `${e.policyId}: ${e.error.message}`).join('; ')}`);
    }
    return { allowed: decision === 'allow', reasons: [...diagnostics.reason].sort() };
  }

  return {
    policySha256,
    policyCount: Object.keys(byId).length,
    evaluate: (input) => ({ invoke: ask('invoke', input), unattended: ask('invoke_unattended', input) }),
  };
}

export function loadCedarEngine(dir: string): CedarEngine {
  return createCedarEngine(
    fs.readFileSync(path.join(dir, 'tool-call.cedar'), 'utf8'),
    fs.readFileSync(path.join(dir, 'schema.cedarschema'), 'utf8'),
  );
}
