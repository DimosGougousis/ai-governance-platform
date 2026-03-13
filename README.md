# AI Governance Monitoring Platform

Enterprise-grade, self-hosted platform for monitoring and governing AI agents across any tool ecosystem. Built on the principle of **tool-agnostic governance** — the platform defines standardized data contracts, and any tool can satisfy them through universal ingestion protocols.

## Why This Exists

Organizations deploying AI agents face a governance gap: frameworks define *what* to govern, but no operational software *enforces and visualizes* it in real time. Teams use diverse tool stacks (LangSmith, Langfuse, MLflow, N8N, custom systems), making vendor-locked monitoring impossible at scale.

This platform solves that by defining **7 Governance Data Contracts** — the standard data shapes every agent must provide — and **3 Universal Ingestion Protocols** that any tool can push data through.

## Core Concepts

### Governance Data Contracts (C1–C7)

| Contract | Purpose | Required By |
|----------|---------|-------------|
| **C1** Identity & Registration | Who is this agent? | All tiers |
| **C2** Health & Liveness | Is it working? | All tiers |
| **C3** Traces & Reasoning | What did it decide and why? | Limited, High |
| **C4** Cost & Usage | How much does it cost? | All tiers |
| **C5** Quality & Drift | Is it degrading? | High |
| **C6** Guardrail Events | What was blocked/modified? | Limited, High |
| **C7** Decisions & Delegations | What autonomous actions occurred? | High only |

### 3 Universal Ingestion Protocols

| Protocol | Endpoint | Best For |
|----------|----------|----------|
| **OpenTelemetry OTLP** | gRPC `:4317`, HTTP `:4318` | Traces (C3), metrics, guardrails (C6) |
| **REST Webhook** | `POST /api/v1/ingest/{contractType}` | Health (C2), cost (C4), drift (C5), decisions (C7) |
| **Bulk JSON** | `POST /api/v1/ingest/bulk` | Batch imports, historical migration |

### Agency-Risk Index (ARI)

Composite score (0.00–1.00) computed across 3 dimensions, each with 4 criteria scored 0–3:
- **Autonomy** — How independently does the agent act?
- **Adaptability** — How much does the agent self-modify?
- **Continuity** — How persistently does the agent operate?

ARI drives the **MI9 Graduated Containment** levels:

| Level | Name | Trigger | Actions |
|-------|------|---------|---------|
| 0 | Standard | ARI ≤ 0.25 | Normal monitoring |
| 1 | State-Preserving | ARI ≤ 0.50 | HITL checkpoints added |
| 2 | Planning Intervention | ARI ≤ 0.75 | Agent planning locked, human review |
| 3 | Tool Restriction | ARI > 0.75 | Write/delete tools revoked ("declawing") |
| 4 | Execution Isolation | Emergency | Full sandbox, NHI revoked, manual restart |

## Architecture

```
ANY TOOL ECOSYSTEM (teams choose their own)
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ LangSmith│ │ Langfuse │ │  MLflow  │ │  Custom  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │
     └────────────┴──────┬─────┴────────────┘
                         │  (push via OTLP / Webhook / Bulk)
                         ▼
┌─────────────────────────────────────────────────────┐
│         CONTRACT VALIDATION & NORMALIZATION          │
│  Zod schema validation → conformance check → store  │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│               DATA LAYER                             │
│  PostgreSQL+TimescaleDB │ Redis │ NATS JetStream     │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│            APPLICATION LAYER (Fastify)               │
│  ARI Engine │ MI9 Containment │ Alert Engine         │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│            FRONTEND (Next.js 14)                     │
│  Tier 1: Board │ Tier 3: Team │ Agent Detail         │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Recharts, TanStack Query |
| Backend | Fastify, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 + TimescaleDB |
| Cache | Redis 7 |
| Messaging | NATS JetStream |
| Validation | Zod (contract schemas) |
| Monorepo | pnpm + Turborepo |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Setup

```bash
# Clone and install
git clone https://github.com/DimosGougousis/ai-governance-platform.git
cd ai-governance-platform
pnpm install

# Start infrastructure (PostgreSQL, Redis, NATS)
docker compose -f infrastructure/docker-compose.yml up -d

# Run database migrations and seed
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm --filter @governance/api dev   # API on http://localhost:4000
pnpm --filter @governance/web dev   # Web on http://localhost:3000
```

### Verify

```bash
# Check agents API
curl http://localhost:4000/api/v1/agents

# Check contract compliance
curl http://localhost:4000/api/v1/agents/{agentId}/contracts

# Ingest health data (C2 contract)
curl -X POST http://localhost:4000/api/v1/ingest/C2 \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "...",
    "timestamp": "2026-03-07T00:00:00Z",
    "modelAvailable": true,
    "toolConnectivity": true,
    "latencyP95Ms": 450,
    "errorRate5m": 0.01,
    "circuitBreakers": {}
  }'
```

## Project Structure

```
ai-governance-platform/
├── packages/
│   ├── web/                    # Next.js 14 frontend
│   │   ├── src/app/            # App Router pages
│   │   │   ├── dashboard/      # Board (T1), Team (T3) dashboards
│   │   │   ├── agents/         # Registry + agent detail
│   │   │   └── ...
│   │   └── src/components/     # Reusable UI components
│   ├── api/                    # Fastify backend
│   │   ├── src/ingestion/      # Tool-agnostic ingestion layer
│   │   │   ├── contract-validator.ts
│   │   │   ├── normalizer.ts
│   │   │   ├── webhook-receiver.ts
│   │   │   └── bulk-importer.ts
│   │   ├── src/routes/         # REST endpoints
│   │   └── src/db/             # Drizzle schema + migrations
│   └── shared/                 # Shared types, Zod validators, constants
├── infrastructure/
│   └── docker-compose.yml      # PostgreSQL, Redis, NATS
└── docs/
    ├── architecture.md
    └── use-cases.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/agents` | List all agents |
| `POST` | `/api/v1/agents` | Register a new agent |
| `GET` | `/api/v1/agents/:id` | Get agent detail |
| `GET` | `/api/v1/agents/:id/contracts` | Contract compliance status |
| `POST` | `/api/v1/ingest/:contractType` | Ingest data via webhook (C2,C4,C5,C6,C7) |
| `POST` | `/api/v1/ingest/bulk` | Bulk data import |
| `GET` | `/api/v1/governance/integrations` | List ingestion sources |
| `GET` | `/api/v1/dashboard/tier/:tier` | Tier-specific dashboard data |
| `GET` | `/api/v1/governance/safest` | SAFEST compliance items |

## Dashboard Tiers

| Tier | Audience | Refresh | Key Metrics |
|------|----------|---------|-------------|
| **T1 Board** | Board/C-Suite | On load | Fleet size, compliance %, audit readiness, ARI distribution |
| **T2 CAIO** | AI Officers | 5 min | Article 11 status, IAMA tracker, regulatory deadlines |
| **T3 Team** | Team Leads | 30s + WS | Agent list, KPIs, health, ARI scores, containment |
| **T4 Runtime** | Ops/ML Eng | Real-time WS | Live metrics, guardrail stream, containment controls |

## EU AI Act Alignment

- **Article 11** auto-documentation (5 required elements)
- **Risk Tier** classification (minimal, limited, high, unacceptable)
- **SAFEST** compliance tracking (112 items across 6 pillars)
- **Dutch Algorithm Register** integration readiness
- **IAMA** Impact Assessment wizard
- **DORA** incident deadline tracking (4h/72h/1mo)

## License

Proprietary — All rights reserved.
