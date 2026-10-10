export type Category = 'read' | 'write' | 'decide' | 'act' | 'escalate';
export type Oversight = 'hitl' | 'hotl' | 'hota';

/** The fields of an Agent Passport the decision point reads. */
export interface Passport {
  agent_id: string;
  identity: { principal_id: string };
  access: {
    mode: 'autonomous' | 'on_behalf_of_user';
    user_claims_in_policy?: { claim: string; must_match_input: string }[];
  };
  permission_boundary_ref: { id: string; version: string };
  mcp_servers?: { server_id: string; allowed_operations: string[] }[];
  enforcement: { mode: 'log_only' | 'enforce'; boundary_version: string };
  registration: { status: string; review_due?: string };
}

export interface McpOperation {
  name: string;
  access: 'read' | 'write' | 'act';
  description_sha256: string;
  requires_user_context: boolean;
  boundary_action?: string;
}

export interface McpServerEntry {
  server_id: string;
  version: string;
  operations: McpOperation[];
  registration: { status: string };
}

export interface Boundary {
  agent_name: string;
  boundary_version: string;
  permissions: Record<Category, { allowed: string[]; denied: string[] }>;
  oversight: Record<Category, Oversight>;
}

export interface DecideRequest {
  agent_id: string;
  server_id: string;
  server_version: string;
  operation: string;
  arguments: Record<string, unknown>;
  observed_description_sha256: string;
  user_claims: Record<string, unknown>;
}

export type Outcome = 'allow' | 'deny' | 'escalate';

export interface DecideResponse {
  decision_id: string;
  decision: Outcome;
  enforced: boolean;
  reasons: string[];
  approval_id?: string;
  policy_sha256: string;
  boundary_version: string | null;
}
