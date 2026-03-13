# AI Governance Platform — User Guide

Complete guide for deploying, operating, and extending the AI Governance Monitoring Platform.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Local Development Setup](#3-local-development-setup)
4. [Production Deployment (Docker)](#4-production-deployment-docker)
5. [Using the Web Interface](#5-using-the-web-interface)
6. [API Reference](#6-api-reference)
7. [Ingesting Governance Data](#7-ingesting-governance-data)
8. [Key Concepts](#8-key-concepts)
9. [Configuration Reference](#9-configuration-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

The AI Governance Platform is a self-hosted monitoring system for governing AI agents. It provides:

- **Agent Registry** — Central inventory of all AI agents with identity, risk tier, and oversight model.
- **Governance Data Contracts (C1–C7)** — Standardized data shapes every agent must satisfy based on its risk tier.
- **Agency-Risk Index (ARI)** — Composite score (0.00–1.00) measuring autonomy, adaptability, and continuity.
- **MI9 Graduated Containment** — Automatic escalation through 5 containment levels (L0–L4) based on ARI.
- **SAFEST Compliance** — Tracking across 6 pillars: Soundness, Accountability, Fairness, Explainability, Sustainability, Transparency.
- **Tiered Dashboards** — Board (T1), CAIO (T2), Team (T3), and Runtime (T4) views for different audiences.

---

## 2. Prerequisites

### For Local Development

| Requirement | Version |
|-------------|---------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.0.0 |
| Docker & Docker Compose | Latest |

### For Production (Docker Only)

| Requirement | Version |
|-------------|---------|
| Docker | >= 24.0 |
| Docker Compose | V2 (included with Docker Desktop) |
| RAM | 4 GB minimum |
| Disk | 10 GB minimum |

---

## 3. Local Development Setup

### 3.1 Clone and Install

```bash
git clone https://github.com/DimosGougousis/ai-governance-platform.git
cd ai-governance-platform
pnpm install
```

### 3.2 Start Infrastructure

Start PostgreSQL (TimescaleDB), Redis, and NATS:

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

Verify services are running:

```bash
docker ps
# Should see: gov-postgres (healthy), gov-redis (healthy), gov-nats
```

### 3.3 Initialize Database

```bash
# Run Drizzle migrations
pnpm db:migrate

# Seed demo data (4 agents, 14 SAFEST items, KPIs, ingestion sources)
pnpm db:seed
```

### 3.4 Start Dev Servers

In two separate terminals:

```bash
# Terminal 1 — API server (port 4000)
pnpm --filter @governance/api dev

# Terminal 2 — Web frontend (port 3000)
pnpm --filter @governance/web dev
```

Or use Turborepo:

```bash
pnpm dev
```

### 3.5 Verify

- Web UI: http://localhost:3000
- API Health: http://localhost:4000/health
- Agents API: http://localhost:4000/api/v1/agents

---

## 4. Production Deployment (Docker)

The platform ships with a complete Docker production setup: multi-stage Dockerfiles, Nginx reverse proxy, and docker-compose orchestration.

### 4.1 Architecture

```
Internet
    │
    ▼ port 80
┌─────────┐
│  Nginx  │ ← Reverse proxy
└─┬─────┬─┘
  │     │
  ▼     ▼
┌─────┐ ┌─────┐
│ API │ │ Web │ ← Application containers
└──┬──┘ └─────┘
   │
   ▼
┌──────────┬───────┬──────┐
│ Postgres │ Redis │ NATS │ ← Infrastructure
└──────────┴───────┴──────┘
```

Only port **80** is exposed externally. All inter-service communication uses a private Docker network.

### 4.2 Quick Deploy (First Time)

```bash
git clone https://github.com/DimosGougousis/ai-governance-platform.git
cd ai-governance-platform

# Make scripts executable
chmod +x scripts/deploy.sh scripts/deploy-init.sh

# First-time deploy (builds, starts, runs migrations + seed)
./scripts/deploy-init.sh
```

This will:
1. Generate `.env.production` from the template with random secrets
2. Build all Docker images (API, Web, Nginx)
3. Start all 7 services
4. Wait for health checks to pass
5. Run database migrations automatically
6. Seed demo data

Access: **http://localhost**

### 4.3 Subsequent Deploys

```bash
./scripts/deploy.sh
```

This builds and starts services without re-seeding the database.

### 4.4 Manual Deploy

If you prefer manual control:

```bash
# 1. Create .env.production from template
cp .env.production.example .env.production

# 2. Edit secrets (REQUIRED — change these!)
#    - POSTGRES_PASSWORD
#    - JWT_SECRET
nano .env.production

# 3. Build images
docker compose -f docker-compose.prod.yml build

# 4. Start services
docker compose -f docker-compose.prod.yml up -d

# 5. Seed data (first time only)
docker compose -f docker-compose.prod.yml --profile init up seed
```

### 4.5 Docker Services

| Service | Image | Internal Port | Purpose |
|---------|-------|--------------|---------|
| `postgres` | timescale/timescaledb:latest-pg16 | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | Cache layer |
| `nats` | nats:2-alpine | 4222 | Event streaming |
| `api` | Custom (multi-stage Node 20) | 4000 | Fastify REST API |
| `web` | Custom (Next.js standalone) | 3000 | Frontend |
| `nginx` | Custom (nginx:alpine) | **80** | Reverse proxy (only exposed port) |
| `seed` | Same as api | — | One-time data seeder (init profile) |

### 4.6 Common Operations

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs api     # API only

# Restart a service
docker compose -f docker-compose.prod.yml restart api

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and remove data volumes (DESTRUCTIVE)
docker compose -f docker-compose.prod.yml down -v

# Rebuild after code changes
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## 5. Using the Web Interface

### 5.1 Navigation

The sidebar provides access to all views:

| Section | Page | Description |
|---------|------|-------------|
| **Dashboards** | Board (Tier 1) | Executive portfolio overview |
| **Dashboards** | Team (Tier 3) | Operational fleet view for team leads |
| **Fleet** | Agent Registry | Full agent inventory table |

The sidebar also shows an **API Connected** indicator when the backend is reachable.

### 5.2 Board Dashboard (Tier 1)

The executive-level dashboard shows:

- **Fleet Size** — Total number of registered agents
- **SAFEST Compliance** — Percentage of compliant governance items
- **Audit Readiness** — Percentage of agents with ARI scores computed
- **Fleet Health** — Percentage of agents in "healthy" state
- **ARI Distribution** — Breakdown of agents across 4 autonomy tiers (Basic, Semi, Highly, Fully Autonomous)
- **Containment Status** — Agents at each containment level (L0 Standard through L4 Isolation)

### 5.3 Team Dashboard (Tier 3)

The operational dashboard for team leads shows:

- Summary cards (Total Agents, Compliance, Healthy Agents, In Containment)
- **Agent Fleet table** with columns: Agent, Type, Health, Risk Tier, ARI Score (with visual gauge), Containment, Team

### 5.4 Agent Registry

A searchable table of all agents showing:

| Column | Description |
|--------|-------------|
| Agent | Name (clickable link to detail) + type |
| Version | Semantic version |
| Model | LLM model identifier |
| Health | Color-coded badge (Healthy/Degraded/Critical/Unknown) |
| Risk | EU AI Act risk tier (Minimal/Limited/High) |
| Oversight | Human oversight model (HITL/HOTL/HOTA) |
| ARI | Visual gauge + numeric score |
| Containment | Level badge with label |
| Env | Deployment environment |
| Owner | Responsible person |

### 5.5 Agent Detail Page

Click any agent name to see its full profile with tabs:

- **Overview** — Identity (ID, Owner, Team, Environment, SPIFFE ID), Capabilities (functions, out-of-scope), ARI Gauge
- **Contracts** — Which of the 7 governance data contracts are required, satisfied, or missing for this agent
- **Health** — Health history (placeholder for C2 data ingestion)
- **KPIs** — Agent-specific key performance indicators with current values, targets, and status
- **ARI** — Large ARI gauge visualization

### 5.6 Visual Indicators

| Component | Meaning |
|-----------|---------|
| **HealthBadge** | Green = Healthy, Yellow = Degraded, Red = Critical, Gray = Unknown |
| **ARIGauge** | Circular gauge from 0.00–1.00 with color zones |
| **ContainmentBadge** | L0 Standard (green) through L4 Isolation (red) |
| **MetricCard** | Metric with value, optional unit, and color-coded status |

---

## 6. API Reference

Base URL: `http://localhost:4000` (dev) or `http://localhost/api` (Docker production)

### 6.1 Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/api/v1/health` | API health check (used by Docker) |

### 6.2 Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/agents` | List all agents |
| `POST` | `/api/v1/agents` | Register a new agent |
| `GET` | `/api/v1/agents/:id` | Get agent detail |
| `PUT` | `/api/v1/agents/:id` | Update an agent |
| `GET` | `/api/v1/agents/:id/contracts` | Contract compliance status |
| `GET` | `/api/v1/agents/:id/health` | Health history |
| `GET` | `/api/v1/agents/:id/kpis` | KPI metrics |
| `POST` | `/api/v1/agents/:id/ari` | Compute ARI score |
| `GET` | `/api/v1/agents/:id/containment` | Current containment state |
| `POST` | `/api/v1/agents/:id/circuit-breaker` | Trigger circuit breaker |
| `GET` | `/api/v1/agents/:id/cost` | Cost summary |
| `GET` | `/api/v1/agents/:id/drift` | Drift reports |

### 6.3 Dashboards

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/dashboard/tier/1` | Board dashboard data |
| `GET` | `/api/v1/dashboard/tier/2` | CAIO dashboard data |
| `GET` | `/api/v1/dashboard/tier/3` | Team dashboard data |
| `GET` | `/api/v1/dashboard/tier/4` | Runtime dashboard data |

### 6.4 Governance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/governance/safest` | SAFEST compliance items |
| `GET` | `/api/v1/governance/integrations` | Ingestion sources status |

### 6.5 Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/ingest/:contractType` | Webhook ingestion (C2, C4, C5, C6, C7) |
| `POST` | `/api/v1/ingest/bulk` | Bulk JSON import |

---

## 7. Ingesting Governance Data

### 7.1 Webhook Ingestion

Push data for individual contracts via the webhook endpoint. Each contract type has a Zod-validated schema.

**C2 — Health & Liveness:**

```bash
curl -X POST http://localhost:4000/api/v1/ingest/C2 \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent-uuid>",
    "timestamp": "2026-03-13T10:00:00Z",
    "modelAvailable": true,
    "toolConnectivity": true,
    "latencyP95Ms": 450,
    "errorRate5m": 0.01,
    "circuitBreakers": {}
  }'
```

**C4 — Cost & Usage:**

```bash
curl -X POST http://localhost:4000/api/v1/ingest/C4 \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent-uuid>",
    "periodStart": "2026-03-01T00:00:00Z",
    "periodEnd": "2026-03-13T00:00:00Z",
    "inputTokens": 150000,
    "outputTokens": 45000,
    "totalCostUsd": 12.50,
    "currency": "USD"
  }'
```

**C5 — Quality & Drift:**

```bash
curl -X POST http://localhost:4000/api/v1/ingest/C5 \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent-uuid>",
    "driftType": "data_drift",
    "score": 0.35,
    "severity": "medium",
    "features": { "feature_a": 0.42, "feature_b": 0.18 },
    "detectionMethod": "kolmogorov_smirnov"
  }'
```

**C7 — Decisions & Delegations:**

```bash
curl -X POST http://localhost:4000/api/v1/ingest/C7 \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<agent-uuid>",
    "decisionType": "approval",
    "summary": "Auto-approved low-risk transaction",
    "authorityLevel": "A2",
    "confidenceScore": 0.92,
    "monetaryImpact": 150.00,
    "reversibility": "reversible"
  }'
```

### 7.2 Bulk Import

Import multiple records at once:

```bash
curl -X POST http://localhost:4000/api/v1/ingest/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      { "contractType": "C2", "data": { ... } },
      { "contractType": "C4", "data": { ... } }
    ]
  }'
```

### 7.3 Contract Requirements by Risk Tier

| Contract | Minimal | Limited | High |
|----------|---------|---------|------|
| C1 Identity | Required | Required | Required |
| C2 Health | Required | Required | Required |
| C3 Traces | — | Required | Required |
| C4 Cost | Required | Required | Required |
| C5 Drift | — | — | Required |
| C6 Guardrails | — | Required | Required |
| C7 Decisions | — | — | Required |

---

## 8. Key Concepts

### 8.1 Agency-Risk Index (ARI)

ARI is a composite score (0.00–1.00) computed across 3 dimensions:

| Dimension | What It Measures | Criteria (4 each, scored 0–3) |
|-----------|-----------------|-------------------------------|
| **Autonomy** | Independence of action | Decision scope, tool access, delegation authority, human override frequency |
| **Adaptability** | Self-modification ability | Learning rate, prompt evolution, strategy changes, model fine-tuning |
| **Continuity** | Operational persistence | Session duration, state persistence, multi-step planning, recovery capability |

**ARI Tiers:**

| Score | Label | Containment Level |
|-------|-------|-------------------|
| 0.00–0.25 | Basic | L0 Standard |
| 0.26–0.50 | Semi-Autonomous | L1 State-Preserving |
| 0.51–0.75 | Highly Autonomous | L2 Planning Lock |
| 0.76–1.00 | Fully Autonomous | L3 Tool Restriction |
| Emergency | — | L4 Isolation |

### 8.2 MI9 Graduated Containment

| Level | Name | What Happens |
|-------|------|-------------|
| L0 | Standard | Normal monitoring, no restrictions |
| L1 | State-Preserving | Human-in-the-loop checkpoints added |
| L2 | Planning Lock | Agent planning paused for human review |
| L3 | Tool Restriction | Write/delete tools revoked ("declawing") |
| L4 | Isolation | Full sandbox, NHI credentials revoked, manual restart required |

### 8.3 Human Oversight Models

| Model | Description |
|-------|-------------|
| **HITL** | Human-in-the-Loop: human approves every critical decision |
| **HOTL** | Human-on-the-Loop: human monitors but agent acts autonomously |
| **HOTA** | Human-over-the-Loop: human sets policies, agent self-governs |

### 8.4 SAFEST Compliance Pillars

| Pillar | Focus Areas |
|--------|-------------|
| **S**oundness | Model validation, performance benchmarks |
| **A**ccountability | Governance framework, roles (RACI), audit trails, circuit breakers |
| **F**airness | Bias detection, demographic parity metrics |
| **E**xplainability | Decision explanations for end users |
| **S**ustainability | Continuous monitoring, drift detection |
| **T**ransparency | Documentation (EU AI Act Art. 11), trace reconstruction |

---

## 9. Configuration Reference

### 9.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://governance:governance@localhost:5432/governance` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `NATS_URL` | `nats://localhost:4222` | NATS connection |
| `API_PORT` | `4000` | API server port |
| `API_HOST` | `0.0.0.0` | API bind address |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Frontend API URL (dev) or `http://localhost/api` (Docker) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:4000` | WebSocket URL |

### 9.2 Production Secrets

The `.env.production` file requires two secrets that must be changed:

```bash
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<random-string-at-least-32-chars>
```

The `scripts/deploy.sh` auto-generates these if `.env.production` doesn't exist.

### 9.3 Database

- **Engine:** PostgreSQL 16 + TimescaleDB extension
- **ORM:** Drizzle ORM with TypeScript schema
- **Migrations:** Located in `packages/api/src/db/migrations/`
- **Schema:** 26 tables (see `packages/api/src/db/schema.ts`)

---

## 10. Troubleshooting

### API Not Responding

```bash
# Check if API container is running
docker compose -f docker-compose.prod.yml ps api

# Check API logs
docker compose -f docker-compose.prod.yml logs api

# Verify health endpoint
curl http://localhost/api/v1/health
```

### Database Connection Errors

```bash
# Check if PostgreSQL is healthy
docker compose -f docker-compose.prod.yml ps postgres

# Verify connection from API container
docker compose -f docker-compose.prod.yml exec api \
  node -e "const pg = require('postgres'); const sql = pg(process.env.DATABASE_URL); sql\`SELECT 1\`.then(r => { console.log('OK'); sql.end(); })"
```

### Frontend Shows "API Not Connected"

1. Verify the API is running: `curl http://localhost:4000/health`
2. Check `NEXT_PUBLIC_API_URL` in your environment
3. For Docker: ensure the Nginx container is running and proxying correctly

### Port Conflicts

| Port | Service | Resolution |
|------|---------|------------|
| 80 | Nginx (Docker prod) | Change port mapping in `docker-compose.prod.yml` |
| 3000 | Next.js (dev) | `pnpm --filter @governance/web dev -- --port 3001` |
| 4000 | Fastify (dev) | Set `API_PORT=4001` in `.env` |
| 5432 | PostgreSQL (Docker prod) | Internal only, no conflict |
| 5433 | PostgreSQL (dev compose) | Change in `infrastructure/docker-compose.yml` |

### Rebuilding After Code Changes

```bash
# Development
# Dev servers auto-reload on file changes (tsx watch / next dev)

# Docker production
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Resetting the Database

```bash
# Development
docker compose -f infrastructure/docker-compose.yml down -v
docker compose -f infrastructure/docker-compose.yml up -d
pnpm db:migrate
pnpm db:seed

# Docker production
docker compose -f docker-compose.prod.yml down -v
./scripts/deploy-init.sh
```

---

## File Reference

```
ai-governance-platform/
├── packages/
│   ├── api/                         # Fastify backend
│   │   ├── Dockerfile               # Multi-stage production build
│   │   ├── docker-entrypoint.sh     # Waits for PG, runs migrations, starts API
│   │   ├── drizzle.config.ts        # Drizzle ORM configuration
│   │   └── src/
│   │       ├── server.ts            # Entry point (port 4000)
│   │       ├── db/
│   │       │   ├── schema.ts        # 26-table database schema
│   │       │   ├── connection.ts    # Database connection
│   │       │   ├── migrate.ts       # Migration runner
│   │       │   ├── seed.ts          # Demo data seeder
│   │       │   └── migrations/      # SQL migration files
│   │       ├── routes/
│   │       │   ├── agents.ts        # 13 agent endpoints
│   │       │   ├── dashboard.ts     # Tier 1–4 dashboard endpoints
│   │       │   └── governance.ts    # SAFEST + integrations endpoints
│   │       └── ingestion/
│   │           ├── contract-validator.ts  # Zod validation for C1–C7
│   │           ├── normalizer.ts         # Contract → DB normalization
│   │           ├── webhook-receiver.ts   # REST webhook handler
│   │           └── bulk-importer.ts      # Bulk JSON import
│   ├── web/                         # Next.js 14 frontend
│   │   ├── Dockerfile               # Multi-stage standalone build
│   │   ├── next.config.mjs          # Standalone output + transpile
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx         # Home (redirects to dashboard)
│   │       │   ├── layout.tsx       # Root layout with sidebar
│   │       │   ├── dashboard/
│   │       │   │   ├── board/page.tsx   # Tier 1 Board Dashboard
│   │       │   │   └── team/page.tsx    # Tier 3 Team Dashboard
│   │       │   └── agents/
│   │       │       ├── page.tsx         # Agent Registry
│   │       │       └── [agentId]/page.tsx  # Agent Detail
│   │       ├── components/
│   │       │   ├── dashboard/
│   │       │   │   ├── ARIGauge.tsx
│   │       │   │   ├── ContainmentBadge.tsx
│   │       │   │   ├── HealthBadge.tsx
│   │       │   │   └── MetricCard.tsx
│   │       │   └── shared/
│   │       │       └── Sidebar.tsx
│   │       └── lib/
│   │           ├── api.ts           # API fetch wrapper
│   │           └── providers.tsx    # React Query provider
│   └── shared/                      # Shared package
│       └── src/
│           ├── index.ts             # Re-exports
│           ├── types/               # TypeScript types
│           ├── validators/          # Zod schemas (contracts, agents)
│           └── constants/           # Containment, health, risk enums
├── infrastructure/
│   ├── docker-compose.yml           # Dev infrastructure (PG:5433, Redis, NATS)
│   └── nginx/
│       ├── Dockerfile               # Production Nginx image
│       └── nginx.conf               # Reverse proxy config
├── scripts/
│   ├── deploy.sh                    # Production deploy script
│   └── deploy-init.sh               # First-time deploy with seed
├── docker-compose.prod.yml          # Full production stack
├── .dockerignore                    # Docker build exclusions
├── .env.example                     # Dev environment template
└── .env.production.example          # Production environment template
```
