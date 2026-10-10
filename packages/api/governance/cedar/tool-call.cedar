// =============================================================================
// Tool-Call Policy (Cedar)
// =============================================================================
// Decides, before an MCP tool call reaches its server, whether the call may
// run (action invoke) and whether it may run without a human
// (action invoke_unattended). The decision point asks both:
//   invoke denied                          -> deny
//   invoke allowed, unattended denied      -> escalate (human approval)
//   both allowed                           -> allow
//
// Every rule is an explicit forbid against a blanket permit, so every denial
// names the rule that made it. Each policy's @id is reported as the reason.
// Schema: schema.cedarschema. Specification: docs/superpowers/specs/
// 2026-10-09-tool-call-enforcement-design.md, Section 2.
// =============================================================================

@id("permit-invoke")
permit (principal, action == Governance::Action::"invoke", resource);

@id("permit-invoke-unattended")
permit (principal, action == Governance::Action::"invoke_unattended", resource);

// 1. Containment (MI9). Level 4 isolates the agent; level 3 revokes write and act.
@id("forbid-containment-isolation")
forbid (principal, action, resource)
when { principal.containment_level >= 4 };

@id("forbid-containment-declawed")
forbid (principal, action, resource)
when {
  principal.containment_level == 3 &&
  (resource.access == "write" || resource.access == "act")
};

// 2. Passport: approved and within its review date.
@id("forbid-passport-not-approved")
forbid (principal, action, resource)
unless { principal.registration_status == "approved" };

@id("forbid-review-overdue")
forbid (principal, action, resource)
when { context.review_overdue };

// 3. MCP server: approved, and running the pinned version.
@id("forbid-server-not-approved")
forbid (principal, action, resource)
unless { resource.server_status == "approved" };

@id("forbid-server-version-drift")
forbid (principal, action, resource)
unless { resource.server_pinned_version == context.observed_server_version };

// 4. Operation: the advertised description is the one that was approved.
@id("forbid-description-mismatch")
forbid (principal, action, resource)
unless { resource.description_sha256 == context.observed_description_sha256 };

// 5. Passport operations: the agent may call only what its passport lists.
@id("forbid-operation-not-in-passport")
forbid (principal, action, resource)
unless { principal.allowed_operations.contains(resource.server_op) };

// 6. User delegation: the delegating user's claims match the call's input.
@id("forbid-user-claims-mismatch")
forbid (principal, action, resource)
when { resource.requires_user_context && !context.user_claims_match };

// 7. Boundary: denied list wins; anything on neither list is denied.
@id("forbid-boundary-denied")
forbid (principal, action, resource)
when { principal.boundary_denied.contains(resource.boundary_key) };

@id("forbid-boundary-unlisted")
forbid (principal, action, resource)
unless {
  principal.boundary_allowed.contains(resource.boundary_key) ||
  principal.boundary_denied.contains(resource.boundary_key)
};

// Oversight: a category with hitl oversight never runs unattended.
@id("forbid-unattended-hitl")
forbid (principal, action == Governance::Action::"invoke_unattended", resource)
unless { principal.unattended_categories.contains(resource.access) };
