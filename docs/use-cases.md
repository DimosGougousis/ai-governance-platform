# Use Cases

This document describes the primary use cases for the AI Governance Monitoring Platform, organized by persona and governance concern.

---

## UC-1: Onboarding a New AI Agent

**Persona:** ML Engineer / Product Team Lead
**Goal:** Register a new AI agent in the governance platform and configure its data ingestion

### Flow

1. **Register agent** via `POST /api/v1/agents` with C1 Identity contract data:
   ```json
   {
     "agentName": "Invoice Processing Agent",
     "agentType": "document_processor",
     "version": "1.0.0",
     "modelId": "claude-3-5-sonnet",
     "modelVersion": "20241022",
     "deployEnv": "staging",
     "riskTier": "high",
     "oversightModel": "HITL",
     "owner": "Finance Team Lead",
     "team": "Finance Automation",
     "functions": ["extract_invoice_data", "validate_amounts", "route_approval"],
     "outOfScope": ["authorize_payment", "modify_vendor"]
   }
   ```

2. **ARI auto-calculated** — platform computes the Agency-Risk Index based on the agent's configuration and assigns initial containment level.

3. **Configure ingestion sources** — team chooses how to satisfy each required contract:
   - C2 Health: custom health endpoint → pushes to `POST /ingest/C2` every 30s
   - C3 Traces: LangSmith → exports OTLP traces to `:4317`
   - C4 Cost: Langfuse → pushes monthly costs to `POST /ingest/C4`
   - C5 Drift: Arize Phoenix → pushes drift scores to `POST /ingest/C5`
   - C6 Guardrails: NeMo Guardrails → exports spans via OTLP
   - C7 Decisions: custom SDK → pushes approval events to `POST /ingest/C7`

4. **Monitor compliance** — dashboard shows which contracts are satisfied, which are missing.

### Acceptance Criteria
- Agent appears in registry with correct risk tier and ARI score
- Contract compliance dashboard shows 7 required contracts for high-risk tier
- Each configured ingestion source shows "last received" timestamps
- Missing contracts trigger alerts to the team lead

---

## UC-2: Real-Time Health Monitoring

**Persona:** Fleet Ops Lead / ML Engineer
**Goal:** Monitor agent fleet health and respond to degradations

### Flow

1. **Agents push health data** via C2 contract every 30-60 seconds:
   ```json
   {
     "agentId": "uuid",
     "timestamp": "2026-03-07T10:15:00Z",
     "modelAvailable": true,
     "toolConnectivity": true,
     "latencyP95Ms": 1200,
     "errorRate5m": 0.08,
     "circuitBreakers": { "payment_api": "half-open" }
   }
   ```

2. **Platform validates** against C2 Zod schema, normalizes, stores in `health_checks` table.

3. **Health state machine** transitions agent state:
   - `healthy` → `degraded` (error rate > 5% threshold)
   - `degraded` → `critical` (error rate > 15% or model unavailable)

4. **Tier 3 Team Dashboard** shows:
   - Agent fleet table with health badges (green/amber/red)
   - Real-time KPI cards (fleet health %, avg latency, error rates)
   - Containment level indicators

5. **Alert triggers** when thresholds breached — RACI-routed notifications.

### Acceptance Criteria
- Health data ingested and stored within 1s of receipt
- Dashboard reflects health state changes within 30s (Tier 3) or <1s (Tier 4)
- Circuit breaker states visible per agent
- Alert sent when error rate exceeds SLA threshold

---

## UC-3: Contract Compliance Audit

**Persona:** Compliance Officer / CAIO
**Goal:** Verify that all agents satisfy their governance data contracts based on risk tier

### Flow

1. Navigate to **Agent Registry** → select agent → **Contracts** tab.

2. Platform displays contract compliance matrix:
   ```
   Contract  │ Required │ Provider        │ Protocol │ Last Received  │ Status
   ──────────┼──────────┼─────────────────┼──────────┼────────────────┼────────
   C1 Identity │ ✓      │ self            │ REST     │ 2026-03-01     │ ✅
   C2 Health   │ ✓      │ custom-checker  │ Webhook  │ 30 seconds ago │ ✅
   C3 Traces   │ ✓      │ langsmith       │ OTLP     │ 2 minutes ago  │ ✅
   C4 Cost     │ ✓      │ langfuse        │ Webhook  │ 2026-03-01     │ ✅
   C5 Drift    │ ✓      │ —               │ —        │ Never          │ ❌
   C6 Guardrails│ ✓     │ nemo-guardrails │ OTLP     │ 5 minutes ago  │ ✅
   C7 Decisions │ ✓     │ —               │ —        │ Never          │ ❌
   ```

3. **Compliance status**: 5/7 contracts satisfied → **Non-compliant** (high-risk agents require all 7).

4. Compliance officer can:
   - View schema validation errors for failed ingestions
   - See historical compliance trends
   - Generate compliance report for audit

### Acceptance Criteria
- Contract compliance accurately reflects which contracts have active, valid data
- "Last received" timestamps update in real time
- Non-compliant agents flagged prominently in dashboard
- Report exportable for regulatory audit

---

## UC-4: Containment Escalation (MI9)

**Persona:** Fleet Ops Lead
**Goal:** Respond to an agent whose ARI score exceeds safety thresholds

### Flow

1. **Fraud Detection Agent** ARI score rises from 0.65 to 0.78 (above Level 3 threshold).

2. **Containment Manager** auto-escalates:
   ```
   Previous: Level 2 (Planning Intervention) — human review of plans
   Current:  Level 3 (Tool Restriction) — write/delete tools revoked
   ```

3. **Tier 3 Dashboard** shows:
   - Agent's containment badge changes from amber to red
   - Alert notification sent to Fleet Ops Lead and Business Owner

4. **Tier 4 Containment Control Center** allows:
   - View current containment actions (kill switch off, tool restrictions active, planning locked)
   - Manually override to Level 4 if needed (execution isolation + NHI revocation)
   - Manually reduce to Level 2 after investigation (requires justification)

5. **If emergency** (policy pass rate drops below 95%):
   - Auto-escalate to Level 4: execution isolation + NHI credential revocation
   - Agent fully sandboxed, requires manual restart
   - Incident auto-created with DORA deadline tracking

### Acceptance Criteria
- ARI-to-containment mapping triggers automatically
- Manual override requires Fleet Ops Lead role
- Level 4 escalation revokes NHI credentials (Identity Kill Switch)
- Containment changes logged in immutable audit log

---

## UC-5: Board-Level Governance Reporting

**Persona:** Board Member / C-Suite
**Goal:** Get a 60-second overview of AI agent governance posture

### Flow

1. Navigate to **Board Dashboard** (Tier 1).

2. Dashboard shows max 12 metrics, designed for executive consumption:
   - **Fleet Size**: 4 agents across 3 teams
   - **SAFEST Compliance**: 72% (target: 80%)
   - **Audit Readiness**: 89% of agents have complete documentation
   - **Fleet Health**: 75% healthy, 25% degraded

3. **ARI Distribution** section:
   ```
   Basic (≤0.25):    1 agent  ████░░░░ 25%
   Semi (≤0.50):     1 agent  ████░░░░ 25%
   Highly (≤0.75):   1 agent  ████░░░░ 25%
   Fully (>0.75):    1 agent  ████░░░░ 25%
   ```

4. **Containment Summary**:
   - Level 0 (Standard): 2 agents
   - Level 2 (Planning): 1 agent
   - Level 3 (Restricted): 1 agent

### Acceptance Criteria
- Dashboard loads via SSR (no spinner)
- Maximum 12 metrics displayed (no information overload)
- ARI distribution histogram renders correctly
- No drill-down access (board members see high-level only)

---

## UC-6: Tool Migration Without Platform Changes

**Persona:** ML Engineer
**Goal:** Switch from LangSmith to Langfuse for tracing without any platform code changes

### Flow

1. Current setup: Customer Support Agent uses **LangSmith** for traces (C3 contract).

2. Team decides to migrate to **Langfuse**.

3. **What changes:**
   - Configure Langfuse to export OTLP traces to platform's `:4317` endpoint
   - Stop LangSmith OTLP export

4. **What doesn't change:**
   - No platform code changes
   - No API modifications
   - No schema changes
   - No deployment needed

5. **Platform auto-detects** the new source via ingestion tracking:
   - Previous ingestion source: `langsmith / otlp / last seen: 10 min ago`
   - New ingestion source: `langfuse / otlp / last seen: 30 sec ago`

6. Contract C3 remains **satisfied** — the platform only cares about the data schema, not the source.

### Acceptance Criteria
- Zero platform changes required for tool migration
- Contract compliance uninterrupted during switchover
- Ingestion source tracking reflects the new provider
- Historical data from previous tool preserved

---

## UC-7: Bulk Historical Data Import

**Persona:** ML Engineer / Data Engineer
**Goal:** Import 6 months of historical cost data from a CSV export

### Flow

1. Export historical data from billing system as JSON.

2. **Bulk import** via `POST /api/v1/ingest/bulk`:
   ```json
   {
     "contractType": "C4",
     "records": [
       {
         "agentId": "uuid-1",
         "period": "2025-09",
         "monthlyTotal": 1100.00,
         "costPerInteraction": 0.07,
         "llmTokenCost": 700.00,
         "toolCallCost": 180.00,
         "infraCost": 220.00
       },
       {
         "agentId": "uuid-1",
         "period": "2025-10",
         "monthlyTotal": 1250.00,
         ...
       }
     ]
   }
   ```

3. **Platform validates** each record against C4 Zod schema:
   - Valid records: normalized and inserted in batches of 500
   - Invalid records: returned with per-record error details

4. **Response** shows summary:
   ```json
   {
     "status": "partial",
     "accepted": 5,
     "rejected": 1,
     "errors": [{ "index": 3, "issues": ["monthlyTotal must be >= 0"] }]
   }
   ```

### Acceptance Criteria
- Supports up to 10,000 records per request
- Per-record validation with clear error reporting
- Successful records inserted even if some fail
- Ingestion source tracking updated

---

## UC-8: EU AI Act Article 11 Documentation

**Persona:** CAIO / Compliance Officer
**Goal:** Auto-generate required documentation for high-risk AI systems

### Flow

1. EU AI Act Article 11 requires **5 documentation elements** for high-risk systems:
   - System Description
   - Development Process
   - Operation & Monitoring
   - Standards Compliance
   - Conformity Assessment

2. Platform **auto-generates** each element from ingested contract data:
   - **System Description**: from C1 (Identity) + C3 (runtime behavior from traces)
   - **Development Process**: from git commits + prompt versioning in C3 traces
   - **Operation/Monitoring**: from C2 (health) + C4 (cost) + C7 (decisions)
   - **Standards**: SAFEST compliance mapped to ISO/IEC 42001
   - **Conformity**: digital CE marking workflow

3. **Article 11 Dashboard** shows completion status:
   ```
   Agent: Fraud Detection Agent (high risk)
   ┌──────────────────────┬──────────┬────────────┐
   │ Element              │ Status   │ Last Updated│
   ├──────────────────────┼──────────┼────────────┤
   │ System Description   │ ✅ Ready │ 2026-03-01 │
   │ Development Process  │ ⚠ Draft  │ 2026-02-15 │
   │ Operation/Monitoring │ ✅ Ready │ 2026-03-07 │
   │ Standards Compliance │ ❌ Missing│ —          │
   │ Conformity Assessment│ ⚠ Draft  │ 2026-01-20 │
   └──────────────────────┴──────────┴────────────┘
   ```

4. Compliance officer reviews, approves, and submits to Algorithm Register.

### Acceptance Criteria
- Auto-generation leverages existing ingested data (no manual data entry)
- Draft documents editable by CAIO/Compliance Officer
- Submission workflow tracks status (draft → ready → submitted → approved)
- Audit trail for all documentation changes

---

## UC-9: Multi-Team Agent Fleet Governance

**Persona:** CAIO / Fleet Ops Lead
**Goal:** Govern AI agents across multiple teams with appropriate access controls

### Flow

1. **Organization has 3 teams** deploying agents:
   - Customer Experience: 2 agents (support bot, recommendation engine)
   - Risk & Compliance: 2 agents (fraud detection, KYC verification)
   - Trust & Safety: 1 agent (content moderation)

2. **RBAC enforcement:**
   - Customer Experience Team Lead sees only their 2 agents in Tier 3 dashboard
   - Risk & Compliance Team Lead sees only their 2 agents
   - Fleet Ops Lead sees all 5 agents across all teams
   - Board sees aggregate metrics only (no agent-level detail)

3. **Cross-team governance:**
   - CAIO views portfolio compliance across all teams
   - Identifies that Risk team's agents have higher ARI scores (0.72, 0.81)
   - Requests additional HITL checkpoints for high-risk agents
   - Tracks implementation via SAFEST compliance items

4. **Audit readiness:**
   - Each team responsible for their agents' contract compliance
   - CAIO accountable for overall governance posture
   - Regulator role provides read-only access to audit logs

### Acceptance Criteria
- Team-scoped views enforce data isolation
- Fleet Ops Lead has cross-team visibility
- CAIO dashboard aggregates compliance across all teams
- RBAC enforced at API level (PostgreSQL RLS)

---

## UC-10: Drift Detection and Response

**Persona:** ML Engineer
**Goal:** Detect and respond to model drift in a production agent

### Flow

1. **Monitoring tool** (e.g., Arize Phoenix) detects concept drift in Fraud Detection Agent.

2. **Pushes C5 contract data** to `POST /api/v1/ingest/C5`:
   ```json
   {
     "agentId": "uuid",
     "driftType": "concept",
     "statisticalTest": "PSI",
     "score": 0.28,
     "severity": 3,
     "features": {
       "transaction_amount": { "psi": 0.28, "baseline": 0.45, "current": 0.73 },
       "merchant_category": { "psi": 0.15, "baseline": 0.30, "current": 0.45 }
     }
   }
   ```

3. **Platform processes:**
   - Validates against C5 schema
   - Stores in `drift_results` table
   - Severity 3 triggers ARI recalculation
   - If ARI threshold crossed → containment escalation

4. **ML Engineer investigates** via Agent Detail → Drift tab:
   - Views drift history (type, severity, features affected)
   - Sees correlation with recent model update
   - Plans remediation (retrain, rollback, or adjust thresholds)

5. **Remediation tracked:**
   - Drift result status updated to "investigating" → "remediated"
   - New model version deployed, drift scores return to normal
   - Containment level reduced after verification

### Acceptance Criteria
- Drift data ingested from any compatible tool
- Severity levels (1-4) map to alert urgency
- Critical drift (severity 4) triggers automatic containment escalation
- Remediation status tracked and auditable
