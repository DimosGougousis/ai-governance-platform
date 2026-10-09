// The governance repository is the policy of record. These files are copied
// from it into packages/api/governance/ by sync-governance.mjs, and the sync
// test fails if the copies drift. Paths: [source in the governance repo,
// destination under packages/api/governance].
export const GOVERNANCE_FILES = [
  ['05-cross-cutting/policy-as-code/agent-passport-schema.yaml', 'schemas/agent-passport-schema.yaml'],
  ['05-cross-cutting/policy-as-code/mcp-server-schema.yaml', 'schemas/mcp-server-schema.yaml'],
  ['05-cross-cutting/policy-as-code/permission-boundary-schema.yaml', 'schemas/permission-boundary-schema.yaml'],
  ['05-cross-cutting/policy-as-code/examples/example-agent-passport.yaml', 'registry/passports/finley.yaml'],
  ['05-cross-cutting/policy-as-code/examples/example-mcp-server.yaml', 'registry/mcp-servers/customer-data.yaml'],
  ['05-cross-cutting/policy-as-code/examples/example-agent-boundary.yaml', 'registry/boundaries/finley.yaml'],
  ['05-cross-cutting/policy-as-code/cedar/schema.cedarschema', 'cedar/schema.cedarschema'],
  ['05-cross-cutting/policy-as-code/cedar/tool-call.cedar', 'cedar/tool-call.cedar'],
];
