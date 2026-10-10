DO $$ BEGIN
 CREATE TYPE "public"."policy_decision_outcome" AS ENUM('allow', 'deny', 'escalate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tool_call_approval_status" AS ENUM('pending', 'approved', 'rejected', 'consumed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_decisions" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"platform_agent_id" uuid,
	"server_id" varchar(255) NOT NULL,
	"operation" varchar(255) NOT NULL,
	"args_sha256" varchar(64) NOT NULL,
	"request" jsonb NOT NULL,
	"outcome" "policy_decision_outcome" NOT NULL,
	"enforced" boolean NOT NULL,
	"reasons" jsonb NOT NULL,
	"policy_sha256" varchar(64) NOT NULL,
	"boundary_version" varchar(50),
	"containment_level" integer,
	"approval_id" varchar(40),
	"latency_ms" real NOT NULL,
	"decided_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_call_approvals" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"agent_id" varchar(255) NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"operation" varchar(255) NOT NULL,
	"args_sha256" varchar(64) NOT NULL,
	"status" "tool_call_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" varchar(255),
	"decided_role" varchar(255),
	"expires_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"consumed_by_decision_id" varchar(40)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "policy_decisions_agent_idx" ON "policy_decisions" USING btree ("agent_id","decided_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_call_approvals_call_idx" ON "tool_call_approvals" USING btree ("agent_id","server_id","operation","args_sha256","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tool_call_approvals_one_pending" ON "tool_call_approvals" USING btree ("agent_id","server_id","operation","args_sha256") WHERE status = 'pending';