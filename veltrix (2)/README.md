# VELTRIX · Two-Tier Observability

A working reference implementation of a two-tier observability architecture where only allowlisted metadata crosses the trust boundary. Tier 1 runs inside the customer network; Tier 2 is the multi-tenant SaaS that ingests signed metadata, runs Health and AIOps engines, and reconciles every packet end-to-end.

**Team:** PILOTSX · #147 · Akash Institute of Engineering
**Members:** Abad Humair Ahamed (lead), Mohammed Tanjil, Gg Jala Firdos S, Misba Khaanum

---

## Quick start (local dev)

```bash
# 1. Install dependencies
bun install
cd mini-services/collector && bun install && cd ../..

# 2. Set up the database
cp .env.example .env   # or set DATABASE_URL=file:./db/custom.db
bun run db:push        # creates tables
bun run db:generate    # generates Prisma Client

# 3. Start both services (in two terminals)
bun run dev                              # Next.js app on :3000
cd mini-services/collector && bun run dev # Collector on :3001

# 4. Open the dashboard
open http://localhost:3000
```

The collector auto-generates telemetry every 4–7 seconds. Within ~10 seconds you'll see packets flowing through the dashboard.

---

## Architecture

```
Browser  ─── HTTPS ───►  Next.js app (port 3000)  ─── Prisma ───  SQLite / Postgres
       ─── WSS ──────►  Collector (port 3001)      ─── bun:sqlite ── raw_logs, outbox
                            │
                            └── POST signed packets ──►  /api/ingest
```

### Tier 1 — Customer Environment (collector mini-service)
- **Runtime:** Bun + socket.io
- **Port:** 3001
- **Database:** SQLite (`mini-services/collector/collector.db`)
- **Pipeline (6 steps):** Collect → Normalize → Mask PII → Aggregate → Local Detect → Apply Policy → Send
- **Raw logs:** 7-day rolling retention, never egress
- **Egress:** HMAC-SHA256 signed metadata packets, queued in SQLite outbox
- **Heartbeat:** Every 10s, no payload data

### Trust Boundary (enforced in code)
- **TLS 1.3** transport encryption
- **X-API-Key** tenant authentication
- **HMAC-SHA256** payload integrity verification
- **SQLite outbox** reliable transport + retry
- **Schema-level allowlist** — no column for raw logs exists on Tier 2

### Tier 2 — Central SaaS Platform (Next.js app)
- **Runtime:** Next.js 16 + Prisma + TypeScript
- **Port:** 3000
- **Database:** SQLite (local dev) / PostgreSQL (production)
- **Models:** Tenant, EgressPacket, HealthMetric, AnomalyEvent, ReconciliationRecord, Notification
- **Ingest API:** verifies HMAC, persists metadata, fires Health + AIOps engines
- **Health engine:** rolling 30-min score from error rate + p95 latency
- **AIOps engine:** error-burst, latency-spike, signature-mismatch, heartbeat-silence detection
- **Reconciliation:** joins every Tier 1 sentAt with Tier 2 receivedAt by packetId UUID

---

## Project structure

```
veltrix/
├── prisma/
│   └── schema.prisma              # 6 models: Tenant, EgressPacket, HealthMetric,
│                                 #   AnomalyEvent, ReconciliationRecord, Notification
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout with dark theme + Toaster
│   │   ├── page.tsx              # Nike-style single-page dashboard
│   │   ├── globals.css           # Black + neon-green 3D terminal theme
│   │   └── api/
│   │       ├── ingest/route.ts          # HMAC-verify, store metadata, fire engines
│   │       ├── ingest/heartbeat/route.ts
│   │       ├── tenants/route.ts         # List tenants
│   │       ├── health/route.ts          # Health summary + 30-min trend
│   │       ├── aiops/route.ts           # Anomaly list + acknowledge/remediate
│   │       ├── reconcile/route.ts       # End-to-end packet pairing
│   │       ├── egress-proof/route.ts    # Proxy to Tier 1 outbox
│   │       ├── local-ui/route.ts        # Customer admin view
│   │       ├── notifications/route.ts   # Active alerts + acknowledge/resolve
│   │       └── chat/route.ts            # z-ai-web-dev-sdk chatbot
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── nav.tsx                  # Sticky top nav with section anchors
│   │   │   ├── hero.tsx                 # Headline + KPI strip
│   │   │   ├── data-flow-hero.tsx       # Animated SVG packets Tier1 → Tier2
│   │   │   ├── section-header.tsx       # Numbered editorial section headers
│   │   │   ├── notifications-bell.tsx   # Red-on-black alerts dropdown
│   │   │   └── header.tsx               # Legacy header (unused)
│   │   ├── boundary/
│   │   │   └── trust-boundary.tsx       # Stays-local vs crosses comparison
│   │   ├── tier1/
│   │   │   ├── pipeline-view.tsx        # 6-step pipeline visualization
│   │   │   ├── live-feed.tsx            # Streaming socket.io event feed
│   │   │   └── local-only-panel.tsx     # Customer admin's local view
│   │   ├── tier2/
│   │   │   ├── tenant-dashboard.tsx     # Health score + stat tiles
│   │   │   ├── health-charts.tsx        # 30-min area + bar charts
│   │   │   ├── aiops-panel.tsx          # Anomaly table + Ack/Remediate
│   │   │   ├── egress-proof-panel.tsx   # Tier 1 outbox proxy view
│   │   │   └── reconciliation-table.tsx # End-to-end packet pairing
│   │   ├── chatbot/
│   │   │   └── chat-widget.tsx          # Floating context-aware assistant
│   │   └── ui/                          # shadcn/ui component library
│   ├── hooks/
│   │   ├── use-collector-socket.ts      # socket.io client (local + remote)
│   │   ├── use-tier2-polling.ts         # 5s polling for Tier 2 API
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   └── lib/
│       ├── db.ts                        # Prisma client singleton
│       ├── notifications.ts             # emitNotification + heartbeat detection
│       ├── seed.ts                      # Idempotent tenant upsert
│       ├── tier2-secrets.ts             # Tenant API keys + HMAC secrets
│       ├── types.ts                     # Shared TypeScript types
│       └── utils.ts                     # cn() className helper
├── mini-services/
│   └── collector/
│       ├── index.ts                     # Tier 1 collector service (Bun)
│       ├── package.json
│       ├── railway.json                 # Railway deploy config
│       └── Procfile
├── vercel.json                          # Vercel deploy config
├── Caddyfile                            # Local gateway (sandbox only)
├── prisma/schema.prisma
└── package.json
```

---

## Production deployment

### Vercel + Railway + Neon

1. **Database (Neon):**
   - Sign up at neon.tech (free)
   - Create a project, copy the connection string
   - In `prisma/schema.prisma`, change `provider = "sqlite"` → `"postgresql"`
   - Set `DATABASE_URL` env var to the Neon string
   - Run `bun run db:push` to create tables in Postgres

2. **Next.js app (Vercel):**
   - Push to GitHub, or run `vercel` from the project root
   - Set env vars:
     - `DATABASE_URL` = Neon connection string
     - `COLLECTOR_BASE` = Railway collector URL (e.g. `https://collector-xyz.up.railway.app`)
   - Deploy

3. **Collector (Railway):**
   - Create a new Railway project from `mini-services/collector/`
   - Set env vars:
     - `INGEST_URL` = `https://yourapp.vercel.app/api/ingest`
     - `CORS_ORIGIN` = `https://yourapp.vercel.app`
     - `PORT` = (Railway provides automatically)
   - Deploy

4. Open `https://yourapp.vercel.app` — dashboard live, packets flowing within 10s.

---

## Two tenants (built-in)

| Code | Name | Region | API Key | HMAC Secret |
|---|---|---|---|---|
| `tenant-a` | Acme Industries | EU | `ak_live_tenantA_eu_2026` | `sec_live_tenantA_7f3c91a8b2` |
| `tenant-b` | Northwind Logistics | IN | `ak_live_tenantB_in_2026` | `sec_live_tenantB_2b8e4d1c90` |

To add a third tenant: add a row to `TENANT_KEYS` in `src/lib/tier2-secrets.ts` and the matching row in `mini-services/collector/index.ts`. No schema change.

---

## Demo script (60 seconds)

1. Open the URL — animated packets flowing Tier 1 → Tier 2 in hero
2. Scroll to **01 Tier 1** — pipeline cards pulsing, live feed streaming
3. Scroll to **02 Boundary** — "Never crosses" vs "Metadata only"
4. Scroll to **04 Insights → AIOps engine** — click **Remediate** → green toast
5. Click **red bell** in nav — 13 live alerts
6. Click **chatbot** bottom-right → "How do I remediate?" → context-aware reply

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Prisma ORM with SQLite (dev) / PostgreSQL (prod)
- **Real-time:** socket.io (server on collector, client on dashboard)
- **Charts:** Recharts
- **AI:** z-ai-web-dev-sdk (chatbot, server-side only)
- **Theme:** next-themes (dark mode canonical)
- **Collector:** Bun runtime + socket.io + SQLite
- **Fonts:** Geist Sans + Geist Mono

---

## License

MIT — built for CICADA 2026 hackathon.
