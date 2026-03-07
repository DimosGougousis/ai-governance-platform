# Architecture Guide

## Design Principles

### Tool-Agnostic Governance (v3 Architecture)

The platform does **not** build connectors for specific tools. Instead, it defines:

1. **7 Governance Data Contracts** — standardized schemas (Zod-validated) that describe the data every agent must provide
2. **3 Universal Ingestion Protocols** — OpenTelemetry OTLP, REST Webhooks, Bulk JSON
3. **Contract Compliance Tracking** — per-agent monitoring of which contracts are being satisfied

Any tool that can push data in the correct schema through any protocol is automatically compatible. The platform is indifferent to the data source.

### Why Not Connectors?

| Approach | Connectors (v1-v2) | Contracts (v3) |
|----------|-------------------|----------------|
| Integration effort | Build + maintain per tool | Define schema once |
| New tool support | Requires code changes | Zero-code (push data) |
| Vendor lock-in | Tightly coupled | Fully decoupled |
| Schema validation | Per-connector logic | Single Zod pipeline |
| Failure isolation | Connector failure = data loss | Protocol failure = retry |

## System Components

### 1. Ingestion Layer (`packages/api/src/ingestion/`)

The ingestion layer is the core of tool-agnosticism. It consists of:

```
                    ANY TOOL
                       │
                       ▼
              ┌────────────────┐
              │ Protocol Router │
              │ (OTLP/Webhook/ │
              │  Bulk JSON)    │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   Contract     │
              │   Validator    │  ← Zod schemas (C1-C7)
              │ (Zod + rules)  │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   Normalizer   │  ← Convert external → internal format
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │   Database     │  ← Drizzle ORM insert
              │   + Tracking   │  ← Update ingestion_sources
              └────────────────┘
```

**Contract Validator** (`contract-validator.ts`):
- Validates payloads against Zod schemas for each contract type
- Checks contract compliance per agent based on risk tier
- Returns structured validation errors

**Normalizer** (`normalizer.ts`):
- Transforms validated contract data into database-ready rows
- Handles type conversions (strings → Dates, numbers → decimals)
- Maps contract fields to internal table columns

**Webhook Receiver** (`webhook-receiver.ts`):
- `POST /api/v1/ingest/:contractType` — accepts C2, C4, C5, C6, C7
- Rejects C1 (use agent CRUD) and C3 (use OTLP) with helpful messages
- Validates → normalizes → inserts → updates ingestion tracking

**Bulk Importer** (`bulk-importer.ts`):
- `POST /api/v1/ingest/bulk` — accepts `{contractType, records[]}`
- Batch validation with per-record error reporting
- Inserts in chunks of 500 for performance

### 2. Data Layer

**PostgreSQL 16 + TimescaleDB** — single database for relational + time-series:

```
Core Tables (17 total):
├── agents                    # Fleet registry with ARI + containment
├── ari_calculations          # ARI scoring history
├── ingestion_sources         # Per-agent per-contract data sources
├── health_checks             # C2 health snapshots
├── cost_records              # C4 cost tracking
├── drift_results             # C5 drift detection
├── guardrail_events          # C6 guardrail triggers
├── autonomous_decisions      # C7 decision log
├── safest_items              # 112 SAFEST compliance items
├── agent_kpis                # KPI definitions + thresholds
├── incidents                 # DORA-tracked incidents
├── audit_log                 # Immutable audit trail
├── nhi_credentials           # Non-Human Identity lifecycle
├── article_11_documentation  # EU AI Act Article 11
├── delegation_chains         # Multi-agent delegation
├── swarm_topology            # Agent dependency graph
└── users                     # RBAC with tier access
```

**Redis 7** — session cache, real-time pub/sub, BullMQ backing

**NATS JetStream** — event streaming for governance events

### 3. Application Layer (Fastify)

```
Routes:
├── agents.ts          # Agent CRUD + health + KPIs
├── governance.ts      # SAFEST, integrations, maturity
├── dashboard.ts       # Tier-specific dashboard data (1-4)
├── ingestion/
│   ├── webhook-receiver.ts   # REST webhook ingestion
│   └── bulk-importer.ts      # Batch import
└── (planned)
    ├── ari.ts                # ARI recalculation
    ├── containment.ts        # MI9 containment controls
    ├── nhi.ts                # NHI identity management
    └── article11.ts          # Auto-documentation
```

### 4. Frontend (Next.js 14)

**App Router pages** with client-side data fetching:

```
/                           → Redirect to /dashboard/team
/dashboard/team             → Tier 3: Agent fleet table, KPI cards
/dashboard/board            → Tier 1: Portfolio metrics, ARI distribution
/agents                     → Agent Registry (full table)
/agents/:agentId            → Agent detail (5 tabs: Overview, Contracts, Health, KPIs, ARI)
```

**Key components:**
- `MetricCard` — KPI display with green/amber/red/neutral status
- `ARIGauge` — Radial gauge (0.00-1.00) with color zones
- `Sidebar` — Navigation with active page highlighting
- `AppShell` — Layout wrapper with providers (QueryClient, etc.)

## Data Flow: Tool → Dashboard

Example: A team uses LangSmith for tracing and a custom health checker.

```
1. LangSmith exports OTLP traces     → :4317 (gRPC)  → C3 Traces
2. Custom health checker POSTs JSON   → /ingest/C2    → C2 Health
3. Billing system POSTs monthly costs → /ingest/C4    → C4 Cost

   Each ingestion:
   a. Zod validates against contract schema
   b. Normalizer transforms to DB format
   c. Drizzle inserts into appropriate table
   d. ingestion_sources tracking updated (last_received_at, schema_valid)

4. Frontend fetches /api/v1/agents/:id/contracts
   → Returns: { required: [C1-C7], satisfied: [C2,C3,C4], missing: [C1,C5,C6,C7] }

5. Dashboard renders compliance status per agent
```

## Contract Compliance Logic

Each agent's **risk tier** determines which contracts are required:

```typescript
const CONTRACT_REQUIREMENTS = {
  minimal:      ['C1', 'C2'],
  limited:      ['C1', 'C2', 'C3', 'C4', 'C6'],
  high:         ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
  unacceptable: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
};
```

An agent is **compliant** when all required contracts have active ingestion sources with recent data and valid schemas.

## ARI Calculation

```
ARI Score = sum(all 12 criteria scores) / (12 × 3)

Autonomy (4 criteria):
  - Decision scope (0-3)
  - Resource access (0-3)
  - Communication autonomy (0-3)
  - Goal interpretation (0-3)

Adaptability (4 criteria):
  - Self-modification (0-3)
  - Learning rate (0-3)
  - Strategy variation (0-3)
  - Environment response (0-3)

Continuity (4 criteria):
  - Operational persistence (0-3)
  - Recovery capability (0-3)
  - State management (0-3)
  - Multi-session memory (0-3)

Result: 0.00 (no agency) → 1.00 (full agency)
```

## Security Model

**RBAC with 8 roles:**

| Role | Tier Access | Capabilities |
|------|------------|--------------|
| Board | T1 | View board dashboard |
| CAIO | T1+T2 | Portfolio management, deadlines |
| Compliance Officer | T2+SAFEST | Evidence review, audit |
| Product Team Lead | T3 (own team) | View team agents, KPIs |
| ML Engineer | T3+T4 (own) | Ingestion config, drift |
| Fleet Ops Lead | T3+T4 (all) | Cross-team, circuit breakers |
| Auditor | Read-only all | Export logs, reports |
| Regulator | Read-only T1+T2 | DNB access per SAFEST A-14 |

## Deployment

**Development:** Docker Compose with 3 infrastructure services:
- `gov-postgres` — TimescaleDB on port 5433
- `gov-redis` — Redis 7 on port 6379
- `gov-nats` — NATS JetStream on port 4222

**Production (planned):** Kubernetes with Helm charts, HPA, NetworkPolicy, CronJobs.
