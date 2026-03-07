DO $$ BEGIN
 CREATE TYPE "public"."ap_submission_status" AS ENUM('draft', 'ready', 'submitted', 'approved');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."article11_element" AS ENUM('description', 'development', 'operation', 'standards', 'conformity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."authority_level" AS ENUM('A1', 'A2', 'A3', 'A4', 'A5');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."chain_status" AS ENUM('active', 'completed', 'failed', 'timeout');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."contract_type" AS ENUM('C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."deploy_env" AS ENUM('development', 'staging', 'production');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."drift_type" AS ENUM('data', 'concept', 'prompt', 'tool_use');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."governance_tier" AS ENUM('basic', 'semi', 'highly', 'fully');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."guardrail_action" AS ENUM('block', 'allow', 'modify');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."health_state" AS ENUM('healthy', 'degraded', 'critical', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."incident_status" AS ENUM('open', 'investigating', 'mitigated', 'resolved', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ingestion_protocol" AS ENUM('otlp', 'webhook', 'bulk');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."kpi_status" AS ENUM('green', 'amber', 'red');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."oversight_model" AS ENUM('HITL', 'HOTL', 'HOTA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."reversibility" AS ENUM('reversible', 'partially_reversible', 'irreversible');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."risk_tier" AS ENUM('minimal', 'limited', 'high', 'unacceptable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."safest_pillar" AS ENUM('soundness', 'accountability', 'fairness', 'explainability', 'sustainability', 'transparency');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."safest_priority" AS ENUM('must_have', 'should_have', 'could_have');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."safest_status" AS ENUM('not_started', 'in_progress', 'compliant', 'non_compliant', 'not_applicable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"kpi_name" varchar(255) NOT NULL,
	"metric_id" varchar(100) NOT NULL,
	"definition" text NOT NULL,
	"target" numeric(10, 4) NOT NULL,
	"warning_threshold" numeric(10, 4) NOT NULL,
	"critical_threshold" numeric(10, 4) NOT NULL,
	"measurement_window" varchar(50) NOT NULL,
	"data_source" varchar(255) NOT NULL,
	"current_value" numeric(10, 4),
	"current_status" "kpi_status"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" varchar(255) NOT NULL,
	"agent_type" varchar(100) NOT NULL,
	"version" varchar(50) NOT NULL,
	"model_id" varchar(255) NOT NULL,
	"model_version" varchar(50) NOT NULL,
	"deploy_env" "deploy_env" DEFAULT 'development' NOT NULL,
	"health_state" "health_state" DEFAULT 'unknown' NOT NULL,
	"risk_tier" "risk_tier" DEFAULT 'limited' NOT NULL,
	"oversight_model" "oversight_model" DEFAULT 'HITL' NOT NULL,
	"nhi_identity" varchar(255),
	"spiffe_id" varchar(255),
	"ari_score" numeric(3, 2),
	"current_containment_level" integer DEFAULT 0 NOT NULL,
	"business_owner_id" uuid,
	"roi_baseline" jsonb,
	"dutch_algorithm_register_id" varchar(100),
	"owner" varchar(255) NOT NULL,
	"team" varchar(255) NOT NULL,
	"functions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"out_of_scope" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safety_policy_ref" varchar(500),
	"fallback_ref" varchar(500),
	"guardrail_ref" varchar(500),
	"eval_suite_ref" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_deploy_date" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ari_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"autonomy_scores" jsonb NOT NULL,
	"adaptability_scores" jsonb NOT NULL,
	"continuity_scores" jsonb NOT NULL,
	"composite_score" numeric(3, 2) NOT NULL,
	"governance_tier" "governance_tier" NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "article_11_documentation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"doc_element" "article11_element" NOT NULL,
	"content" jsonb NOT NULL,
	"version_hash" varchar(64) NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"ap_submission_status" "ap_submission_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"actor_type" varchar(50) NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(45),
	"correlation_id" uuid,
	"checksum" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "autonomous_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" uuid,
	"agent_id" uuid NOT NULL,
	"decision_type" varchar(100) NOT NULL,
	"authority_level" "authority_level" NOT NULL,
	"confidence_score" numeric(5, 4) NOT NULL,
	"monetary_impact" numeric(12, 2),
	"reversibility" "reversibility" NOT NULL,
	"human_involvement" varchar(100) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"period" varchar(20) NOT NULL,
	"monthly_total" numeric(12, 2) NOT NULL,
	"cost_per_interaction" numeric(8, 4) NOT NULL,
	"llm_token_cost" numeric(12, 2) NOT NULL,
	"tool_call_cost" numeric(12, 2) NOT NULL,
	"infra_cost" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delegation_chains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" varchar(255) NOT NULL,
	"customer_id" varchar(255),
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"chain_depth" integer DEFAULT 0 NOT NULL,
	"chain_status" "chain_status" DEFAULT 'active' NOT NULL,
	"final_outcome" text,
	"hitl_involved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drift_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"drift_type" "drift_type" NOT NULL,
	"statistical_test" varchar(100) NOT NULL,
	"score" numeric(8, 6) NOT NULL,
	"severity" integer NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detection_method" varchar(100) NOT NULL,
	"remediation_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guardrail_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"rail_type" varchar(100) NOT NULL,
	"action" "guardrail_action" NOT NULL,
	"trigger_reason" text NOT NULL,
	"input_hash" varchar(64),
	"containment_level" integer,
	"escalation_trigger" varchar(50),
	"containment_actions" jsonb,
	"human_owner_notified" boolean DEFAULT false,
	"sandbox_migration_ref" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "health_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"model_available" boolean NOT NULL,
	"tool_connectivity" boolean NOT NULL,
	"latency_p95_ms" integer NOT NULL,
	"error_rate_5m" numeric(5, 4) NOT NULL,
	"circuit_breakers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_interaction" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"dora_reporting_required" boolean DEFAULT false NOT NULL,
	"dora_deadline" timestamp,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"root_cause" text,
	"corrective_actions" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingestion_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"protocol" "ingestion_protocol" NOT NULL,
	"endpoint_url" varchar(500),
	"api_key_hash" varchar(64),
	"last_received_at" timestamp,
	"schema_valid" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nhi_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"spiffe_svid" text,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"rotation_count" integer DEFAULT 0 NOT NULL,
	"last_rotated_at" timestamp,
	"revoked" boolean DEFAULT false NOT NULL,
	"revocation_reason" text,
	"jit_token_hash" varchar(64)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safest_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pillar" "safest_pillar" NOT NULL,
	"category" varchar(255) NOT NULL,
	"item_code" varchar(20) NOT NULL,
	"item_text" text NOT NULL,
	"priority" "safest_priority" NOT NULL,
	"status" "safest_status" DEFAULT 'not_started' NOT NULL,
	"evidence_ref" varchar(500),
	"regulatory_ref" varchar(500),
	"notes" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "safest_items_item_code_unique" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "swarm_topology" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"swarm_id" uuid NOT NULL,
	"keystone_agent_id" uuid NOT NULL,
	"downstream_dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cascading_risk_coefficient" integer DEFAULT 1 NOT NULL,
	"topology_graph" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'viewer' NOT NULL,
	"team" varchar(255),
	"tier_access" jsonb DEFAULT '[3]'::jsonb NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_kpis" ADD CONSTRAINT "agent_kpis_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ari_calculations" ADD CONSTRAINT "ari_calculations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "article_11_documentation" ADD CONSTRAINT "article_11_documentation_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "autonomous_decisions" ADD CONSTRAINT "autonomous_decisions_chain_id_delegation_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."delegation_chains"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "autonomous_decisions" ADD CONSTRAINT "autonomous_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drift_results" ADD CONSTRAINT "drift_results_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardrail_events" ADD CONSTRAINT "guardrail_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ingestion_sources" ADD CONSTRAINT "ingestion_sources_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nhi_credentials" ADD CONSTRAINT "nhi_credentials_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "swarm_topology" ADD CONSTRAINT "swarm_topology_keystone_agent_id_agents_id_fk" FOREIGN KEY ("keystone_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_team_idx" ON "agents" USING btree ("team");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_health_idx" ON "agents" USING btree ("health_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_risk_idx" ON "agents" USING btree ("risk_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ari_agent_idx" ON "ari_calculations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ari_calc_date_idx" ON "ari_calculations" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingestion_agent_contract_idx" ON "ingestion_sources" USING btree ("agent_id","contract_type");