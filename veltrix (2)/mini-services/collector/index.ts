/**
 * Tier 1 — Customer Environment (Local Collector) mini-service.
 *
 * Simulates the on-prem telemetry collector described in the
 * Two-Tier Observability architecture:
 *
 *   1. Collect raw telemetry from app servers / network devices / security sources
 *   2. Normalize
 *   3. Mask PII (IPs, usernames, payloads, keys)
 *   4. Aggregate into per-source rollups
 *   5. Run local detection (anomalies stay local)
 *   6. Apply data policy: only metadata may egress
 *
 * Egress path:
 *   - Build a metadata packet (no raw logs, no PII)
 *   - Compute HMAC-SHA256 over the canonical payload
 *   - POST to Tier 2 Ingest API with X-API-Key + X-Signature headers
 *   - Append to a local SQLite outbox for reliable transport & reconciliation
 *
 * Also serves a socket.io server so the local UI can watch the pipeline live.
 * Runs on port 3001.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'
import { createHash, createHmac, randomUUID } from 'crypto'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Render/Railway provide PORT; fall back to 3001 for local dev.
const PORT = Number(process.env.PORT) || 3001
// DB path can be overridden (Render persistent disk, Railway volume, etc.)
const DB_PATH = process.env.DB_PATH || join(import.meta.dir, 'collector.db')

// Shared secret between Tier 1 collector and Tier 2 ingest API.
// In production each tenant has its own rotating key; here we use one per tenant.
const TENANT_KEYS: Record<string, { apiKey: string; hmacSecret: string; region: string; name: string }> = {
  'tenant-a': {
    apiKey: 'ak_live_tenantA_eu_2026',
    hmacSecret: 'sec_live_tenantA_7f3c91a8b2',
    region: 'EU',
    name: 'Tenant A — Acme Industries',
  },
  'tenant-b': {
    apiKey: 'ak_live_tenantB_in_2026',
    hmacSecret: 'sec_live_tenantB_2b8e4d1c90',
    region: 'IN',
    name: 'Tenant B — Northwind Logistics',
  },
}

// Tier 2 Ingest API base URL.
//   - Local dev (sandbox): defaults to http://localhost:3000/api/ingest
//   - Production (Vercel): set INGEST_URL=https://your-app.vercel.app/api/ingest
const INGEST_URL = process.env.INGEST_URL || 'http://localhost:3000/api/ingest'

// CORS allow-list for the socket.io + HTTP endpoints.
//   - Local dev: '*' (any origin)
//   - Production: set CORS_ORIGIN=https://your-app.vercel.app so only the
//     Vercel deployment can connect.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

// ---------------------------------------------------------------------------
// Local SQLite store (Tier 1 only) — never crosses the trust boundary.
// ---------------------------------------------------------------------------

mkdirSync(join(import.meta.dir), { recursive: true })
const sqlite = new Database(DB_PATH, { create: true })
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS raw_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    tenant_code TEXT NOT NULL,
    source_type TEXT NOT NULL,
    host TEXT NOT NULL,
    ip TEXT NOT NULL,
    user TEXT,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_raw_logs_ts ON raw_logs(ts);

  CREATE TABLE IF NOT EXISTS outbox (
    packet_id TEXT PRIMARY KEY,
    tenant_code TEXT NOT NULL,
    source_type TEXT NOT NULL,
    region TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    hmac TEXT NOT NULL,
    queued_at INTEGER NOT NULL,
    sent_at INTEGER,
    acked_at INTEGER,
    status TEXT NOT NULL DEFAULT 'queued'
  );
  CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);

  CREATE TABLE IF NOT EXISTS local_detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    tenant_code TEXT NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL,
    severity TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS heartbeat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    tenant_code TEXT NOT NULL,
    ok INTEGER NOT NULL
  );
`)

// 7-day rolling retention for raw logs.
function pruneOldRawLogs() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  sqlite.run('DELETE FROM raw_logs WHERE ts < ?', cutoff)
}

// ---------------------------------------------------------------------------
// Telemetry sources (simulated)
// ---------------------------------------------------------------------------

type SourceType = 'app-server' | 'network-device' | 'security-source'

const HOSTS: Record<SourceType, string[]> = {
  'app-server': ['app-prod-01', 'app-prod-02', 'app-stage-03'],
  'network-device': ['edge-router-1', 'core-sw-7', 'fw-perimeter'],
  'security-source': ['ids-sensor-2', 'edr-endpoint-grp'],
}

const USERS = ['alice', 'bob', 'carol', 'svc-payment', 'svc-notifier', 'root']
const SAMPLE_PAYLOADS = [
  'POST /api/checkout HTTP/1.1 500 - body=card=4111111111111111;exp=04/27',
  'GET /health 200 12ms user=alice session=sess_8f3c91',
  'SSH login failed from 203.0.113.45 user=root',
  'DB query timeout table=orders latency=2400ms',
  'NET link flap if=eth0 mtu=1500 drops=12',
  'IDS alert:可疑横向移动 src=10.0.4.21 dst=10.0.4.88',
  'AUTH token rotated kid=k-7 prev=k-6 user=svc-payment',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1))
}
function randFloat(min: number, max: number) {
  return +(min + Math.random() * (max - min)).toFixed(2)
}

interface RawLog {
  ts: number
  tenantCode: string
  sourceType: SourceType
  host: string
  ip: string
  user: string | null
  payload: string
}

function generateRawLog(tenantCode: string): RawLog {
  const sourceType = pick<SourceType>(['app-server', 'network-device', 'security-source'])
  const host = pick(HOSTS[sourceType])
  const ip = `10.${randInt(0, 32)}.${randInt(0, 255)}.${randInt(1, 254)}`
  const user = Math.random() > 0.4 ? pick(USERS) : null
  const payload = pick(SAMPLE_PAYLOADS)
  return { ts: Date.now(), tenantCode, sourceType, host, ip, user, payload }
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

interface NormalizedLog extends RawLog {
  // trimmed / parsed shape
  method?: string
  path?: string
  status?: number
  latencyMs?: number
}

interface MaskedLog {
  ts: number
  sourceType: SourceType
  hostHash: string // hashed, not raw
  ipBucket: string // /24 bucket only
  userClass: string // role class, not identity
  eventKind: string
  status?: number
  latencyMs?: number
  errorFlag: boolean
}

interface AggregatedRollup {
  windowStart: number
  sourceType: SourceType
  eventCount: number
  errorCount: number
  avgLatencyMs: number
  p95LatencyMs: number
  uniqueHosts: number
  eventKinds: string[]
}

// Step 2 — normalize raw strings into structured fields.
function normalize(raw: RawLog): NormalizedLog {
  const out: NormalizedLog = { ...raw }
  const m = raw.payload.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s+HTTP\/\d\.\d\s+(\d+)/)
  if (m) {
    out.method = m[1]
    out.path = m[2]
    out.status = parseInt(m[3], 10)
  }
  const lat = raw.payload.match(/latency=(\d+)ms/)
  if (lat) out.latencyMs = parseInt(lat[1], 10)
  return out
}

// Step 3 — mask PII. Hosts are hashed, IPs are bucketed to /24,
// users are reduced to a role class, raw payloads are dropped.
function mask(log: NormalizedLog): MaskedLog {
  const hostHash = createHash('sha256').update(log.host).digest('hex').slice(0, 12)
  const ipBucket = log.ip.split('.').slice(0, 3).join('.') + '.0/24'
  let userClass = 'anonymous'
  if (log.user) {
    if (log.user.startsWith('svc-')) userClass = 'service-account'
    else if (log.user === 'root') userClass = 'privileged'
    else userClass = 'standard-user'
  }
  let eventKind = 'generic'
  if (log.status !== undefined) eventKind = 'http-request'
  else if (/SSH/i.test(log.payload)) eventKind = 'auth-event'
  else if (/DB query/i.test(log.payload)) eventKind = 'db-query'
  else if (/NET link/i.test(log.payload)) eventKind = 'network-event'
  else if (/IDS/i.test(log.payload)) eventKind = 'security-alert'
  else if (/AUTH token/i.test(log.payload)) eventKind = 'key-rotation'

  return {
    ts: log.ts,
    sourceType: log.sourceType,
    hostHash,
    ipBucket,
    userClass,
    eventKind,
    status: log.status,
    latencyMs: log.latencyMs,
    errorFlag: (log.status ?? 200) >= 500,
  }
}

// Step 4 — aggregate masked events into a per-source rollup window.
function aggregate(masked: MaskedLog[]): AggregatedRollup {
  const windowStart = masked[0]?.ts ?? Date.now()
  const latencies = masked.map(m => m.latencyMs ?? 0).filter(n => n > 0).sort((a, b) => a - b)
  const avg = latencies.length ? latencies.reduce((s, n) => s + n, 0) / latencies.length : 0
  const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : 0
  const hosts = new Set(masked.map(m => m.hostHash))
  return {
    windowStart,
    sourceType: masked[0].sourceType,
    eventCount: masked.length,
    errorCount: masked.filter(m => m.errorFlag).length,
    avgLatencyMs: +avg.toFixed(2),
    p95LatencyMs: +p95.toFixed(2),
    uniqueHosts: hosts.size,
    eventKinds: Array.from(new Set(masked.map(m => m.eventKind))),
  }
}

// Step 5 — local detection. Findings stay in the customer environment.
function localDetect(masked: MaskedLog[], tenantCode: string): { kind: string; detail: string; severity: string }[] {
  const findings: { kind: string; detail: string; severity: string }[] = []
  const errors = masked.filter(m => m.errorFlag)
  if (errors.length >= 3) {
    findings.push({
      kind: 'error-burst',
      detail: `${errors.length} 5xx events within window from ${errors[0].hostHash.slice(0, 6)}…`,
      severity: errors.length >= 5 ? 'high' : 'medium',
    })
  }
  const security = masked.filter(m => m.eventKind === 'security-alert')
  if (security.length > 0) {
    findings.push({
      kind: 'local-security-event',
      detail: `${security.length} IDS alert(s) in window — kept local, only count egresses`,
      severity: 'high',
    })
  }
  return findings
}

// Step 6 — apply data policy. Build a metadata packet that contains ZERO raw
// data: no IPs, no users, no payloads, no raw hosts. Just aggregates + hashes.
interface MetadataPacket {
  packetId: string
  tenantCode: string
  sourceType: SourceType
  region: string
  windowStart: number
  eventCount: number
  errorCount: number
  avgLatencyMs: number
  p95LatencyMs: number
  uniqueHosts: number
  eventKinds: string[]
  maskedPreview: string // safe preview string with PII removed
}

function buildPacket(
  tenantCode: string,
  sourceType: SourceType,
  rollup: AggregatedRollup,
  maskedSample: MaskedLog,
): MetadataPacket {
  const tenant = TENANT_KEYS[tenantCode]
  const maskedPreview = `event=${maskedSample.eventKind} host=${maskedSample.hostHash.slice(0, 8)}… ipBucket=${maskedSample.ipBucket} userClass=${maskedSample.userClass} status=${maskedSample.status ?? 'n/a'}`
  return {
    packetId: randomUUID(),
    tenantCode,
    sourceType,
    region: tenant.region,
    windowStart: rollup.windowStart,
    eventCount: rollup.eventCount,
    errorCount: rollup.errorCount,
    avgLatencyMs: rollup.avgLatencyMs,
    p95LatencyMs: rollup.p95LatencyMs,
    uniqueHosts: rollup.uniqueHosts,
    eventKinds: rollup.eventKinds,
    maskedPreview,
  }
}

function signPacket(packet: MetadataPacket, secret: string): string {
  // Canonical JSON: keys sorted, no whitespace.
  const canonical = JSON.stringify(
    Object.keys(packet).sort().reduce((acc, k) => {
      ;(acc as any)[k] = (packet as any)[k]
      return acc
    }, {}),
  )
  return createHmac('sha256', secret).update(canonical).digest('hex')
}

// ---------------------------------------------------------------------------
// HTTP transport to Tier 2 (simulated TLS 1.3 + X-API-Key + HMAC header)
// ---------------------------------------------------------------------------

async function postToIngest(packet: MetadataPacket, hmac: string): Promise<{ ok: boolean; status: number; body: string }> {
  const tenant = TENANT_KEYS[packet.tenantCode]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': tenant.apiKey,
        'X-Signature': hmac,
        'X-TLS': 'tls1.3',
      },
      body: JSON.stringify(packet),
      signal: controller.signal,
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body }
  } catch (err: any) {
    return { ok: false, status: 0, body: String(err?.message ?? err) }
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Socket.io server — broadcasts live pipeline events to the local UI.
// ---------------------------------------------------------------------------

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // CORS preflight + headers for cross-origin requests from the Vercel app.
  const setCors = (res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
  }
  if (req.method === 'OPTIONS') {
    setCors(res)
    res.writeHead(204)
    res.end()
    return
  }

  // Tiny health endpoint
  if (req.url === '/health') {
    setCors(res)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'tier1-collector', port: PORT }))
    return
  }
  // Local UI endpoint — exposes a small outbox / raw-log / detections summary.
  // This is the data the customer-admin can see in their local UI; the SaaS
  // operator (Tier 2) only sees the metadata that actually egressed.
  if (req.url && req.url.startsWith('/local-state')) {
    setCors(res)
    const u = new URL(req.url, 'http://localhost')
    const tenant = u.searchParams.get('tenant')
    const tenantFilter = tenant ? ` WHERE tenant_code = ?` : ''
    const params = tenant ? [tenant] : []

    const outbox = sqlite.query(
      `SELECT packet_id, tenant_code, source_type, region, queued_at, sent_at, acked_at, status
       FROM outbox${tenantFilter} ORDER BY queued_at DESC LIMIT 30`,
    ).all(...params) as any[]
    const rawCount = sqlite
      .query(`SELECT COUNT(*) as c FROM raw_logs${tenantFilter}`)
      .get(...params) as any
    const detectionCount = sqlite
      .query(`SELECT COUNT(*) as c FROM local_detections${tenantFilter}`)
      .get(...params) as any
    const heartbeats = sqlite.query(
      `SELECT ts, tenant_code, ok FROM heartbeat${tenantFilter} ORDER BY ts DESC LIMIT 10`,
    ).all(...params) as any[]
    const oldestRaw = sqlite
      .query(`SELECT MIN(ts) as t FROM raw_logs${tenantFilter}`)
      .get(...params) as any
    const retentionDays = oldestRaw?.t ? ((Date.now() - oldestRaw.t) / (1000 * 60 * 60 * 24)).toFixed(2) : '0.00'

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      tenant: tenant ?? 'all',
      rawLogs: { count: rawCount?.c ?? 0, retentionDays, policy: '7-day rolling, never egresses' },
      localDetections: { count: detectionCount?.c ?? 0, policy: 'findings kept local, only counts egress' },
      outbox: outbox.map(o => ({
        packetId: o.packet_id,
        tenantCode: o.tenant_code,
        sourceType: o.source_type,
        region: o.region,
        queuedAt: o.queued_at,
        sentAt: o.sent_at,
        ackedAt: o.acked_at,
        status: o.status,
      })),
      heartbeats: heartbeats.map(h => ({ ts: h.ts, tenantCode: h.tenant_code, ok: !!h.ok })),
    }))
    return
  }
  res.writeHead(404)
  res.end('Not Found')
})

const io = new Server(httpServer, {
  // Use a dedicated sub-path so HTTP routes (/health, /local-state) on the
  // same port are not intercepted by socket.io's engine.io handler.
  path: '/collector-ws',
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface LiveEvent {
  id: string
  ts: number
  tenantCode: string
  step: 'collect' | 'normalize' | 'mask' | 'aggregate' | 'local-detect' | 'policy' | 'egress' | 'heartbeat'
  sourceType?: SourceType
  detail: string
  // Visualization hints
  rawSnippet?: string // masked preview only
  packetId?: string
  hmac?: string
  ok?: boolean
}

function emit(ev: Omit<LiveEvent, 'id' | 'ts'>) {
  const full: LiveEvent = { id: randomUUID(), ts: Date.now(), ...ev }
  io.emit('pipeline-event', full)
}

io.on('connection', (socket: Socket) => {
  console.log(`[collector] UI client connected: ${socket.id}`)
  socket.emit('hello', { service: 'tier1-collector', port: PORT, tenants: Object.keys(TENANT_KEYS) })
  socket.on('disconnect', () => console.log(`[collector] UI client disconnected: ${socket.id}`))
})

// ---------------------------------------------------------------------------
// Per-tenant pipeline loop. Picks a random source, generates a small batch,
// runs all 6 steps, signs, queues, sends, emits live events.
// ---------------------------------------------------------------------------

async function runPipelineOnce(tenantCode: string) {
  const tenant = TENANT_KEYS[tenantCode]
  const sourceType = pick<SourceType>(['app-server', 'network-device', 'security-source'])
  const batchSize = randInt(4, 10)

  // Step 1 — collect
  const rawBatch: RawLog[] = []
  for (let i = 0; i < batchSize; i++) rawBatch.push(generateRawLog(tenantCode))
  // Persist raw logs locally (7-day rolling).
  const insertRawSql = 'INSERT INTO raw_logs (ts, tenant_code, source_type, host, ip, user, payload) VALUES (?, ?, ?, ?, ?, ?, ?)'
  for (const r of rawBatch) sqlite.query(insertRawSql).run(r.ts, r.tenantCode, r.sourceType, r.host, r.ip, r.user, r.payload)
  emit({
    tenantCode,
    step: 'collect',
    sourceType,
    detail: `Collected ${batchSize} raw ${sourceType} events from local agents`,
    rawSnippet: rawBatch[0]!.payload.replace(/=\d{12,}/g, '=****').slice(0, 80),
  })

  // Step 2 — normalize
  const normalized = rawBatch.map(normalize)
  emit({
    tenantCode,
    step: 'normalize',
    sourceType,
    detail: `Normalized ${normalized.length} events: parsed methods, status, latency`,
  })

  // Step 3 — mask
  const masked = normalized.map(mask)
  emit({
    tenantCode,
    step: 'mask',
    sourceType,
    detail: `Masked PII: hosts hashed, IPs bucketed to /24, users reduced to role class`,
    rawSnippet: `host=${masked[0]!.hostHash.slice(0, 8)}… ip=${masked[0]!.ipBucket} user=${masked[0]!.userClass}`,
  })

  // Step 4 — aggregate
  const rollup = aggregate(masked)
  emit({
    tenantCode,
    step: 'aggregate',
    sourceType,
    detail: `Aggregated ${rollup.eventCount} events → ${rollup.errorCount} errors, p95=${rollup.p95LatencyMs}ms, hosts=${rollup.uniqueHosts}`,
  })

  // Step 5 — local detection
  const findings = localDetect(masked, tenantCode)
  const insertDetectionSql = 'INSERT INTO local_detections (ts, tenant_code, kind, detail, severity) VALUES (?, ?, ?, ?, ?)'
  for (const f of findings) sqlite.query(insertDetectionSql).run(Date.now(), tenantCode, f.kind, f.detail, f.severity)
  emit({
    tenantCode,
    step: 'local-detect',
    sourceType,
    detail: findings.length
      ? `Detected ${findings.length} local finding(s): ${findings.map(f => f.kind).join(', ')} — kept local, never egress`
      : 'No local findings in window',
  })

  // Step 6 — apply data policy: build metadata packet
  const packet = buildPacket(tenantCode, sourceType, rollup, masked[0]!)
  const hmac = signPacket(packet, tenant.hmacSecret)
  emit({
    tenantCode,
    step: 'policy',
    sourceType,
    detail: `Built metadata packet ${packet.packetId.slice(0, 8)} — raw logs, keys, IPs, users, payloads EXCLUDED`,
    rawSnippet: packet.maskedPreview,
    packetId: packet.packetId,
    hmac,
  })

  // Queue in outbox (reliable transport)
  const insertOutboxSql = `INSERT INTO outbox (packet_id, tenant_code, source_type, region, payload_json, hmac, queued_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')`
  sqlite.query(insertOutboxSql).run(packet.packetId, packet.tenantCode, packet.sourceType, packet.region, JSON.stringify(packet), hmac, Date.now())

  // Egress — POST to Tier 2 ingest API (TLS 1.3 + X-API-Key + HMAC-SHA256)
  emit({
    tenantCode,
    step: 'egress',
    sourceType,
    detail: `Sending signed packet to Tier 2 (TLS1.3, X-API-Key, HMAC-SHA256) → ${tenant.region} ingest endpoint`,
    packetId: packet.packetId,
  })
  const result = await postToIngest(packet, hmac)
  if (result.ok) {
    sqlite.run(
      'UPDATE outbox SET sent_at = ?, acked_at = ?, status = ? WHERE packet_id = ?',
      Date.now(), Date.now(), 'delivered', packet.packetId,
    )
    emit({
      tenantCode,
      step: 'egress',
      sourceType,
      detail: `Tier 2 acknowledged packet (${result.status}) — metadata stored centrally`,
      packetId: packet.packetId,
      hmac,
      ok: true,
    })
  } else {
    sqlite.run(
      'UPDATE outbox SET sent_at = ?, status = ? WHERE packet_id = ?',
      Date.now(), 'pending-retry', packet.packetId,
    )
    emit({
      tenantCode,
      step: 'egress',
      sourceType,
      detail: `Egress failed (${result.status}): ${result.body.slice(0, 80)} — will retry`,
      packetId: packet.packetId,
      ok: false,
    })
  }
}

// Heartbeat — Tier 1 sends a lightweight heartbeat every ~10s so Tier 2
// knows the collector is alive. Heartbeats carry NO data.
async function sendHeartbeat(tenantCode: string) {
  const tenant = TENANT_KEYS[tenantCode]
  const payload = JSON.stringify({ tenantCode, region: tenant.region, ts: Date.now() })
  const hmac = createHmac('sha256', tenant.hmacSecret).update(payload).digest('hex')
  try {
    const res = await fetch(`${INGEST_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': tenant.apiKey, 'X-Signature': hmac },
      body: payload,
    })
    sqlite.run('INSERT INTO heartbeat (ts, tenant_code, ok) VALUES (?, ?, ?)', Date.now(), tenantCode, res.ok ? 1 : 0)
    emit({
      tenantCode,
      step: 'heartbeat',
      detail: `Heartbeat ${res.ok ? 'acked' : 'failed'} (${res.status}) — no payload data transmitted`,
      ok: res.ok,
    })
  } catch (err: any) {
    sqlite.run('INSERT INTO heartbeat (ts, tenant_code, ok) VALUES (?, ?, ?)', Date.now(), tenantCode, 0)
    emit({ tenantCode, step: 'heartbeat', detail: `Heartbeat error: ${err?.message ?? err}`, ok: false })
  }
}

// ---------------------------------------------------------------------------
// Schedulers
// ---------------------------------------------------------------------------

const TENANTS = Object.keys(TENANT_KEYS)

// Each tenant runs an independent pipeline tick every 4–7 seconds.
async function tenantLoop(tenantCode: string) {
  while (true) {
    try {
      await runPipelineOnce(tenantCode)
    } catch (err) {
      console.error(`[collector] pipeline error for ${tenantCode}:`, err)
    }
    await Bun.sleep(4000 + Math.random() * 3000)
  }
}

async function heartbeatLoop() {
  while (true) {
    for (const t of TENANTS) await sendHeartbeat(t)
    await Bun.sleep(10000)
  }
}

async function retentionLoop() {
  while (true) {
    pruneOldRawLogs()
    await Bun.sleep(60 * 60 * 1000) // hourly
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[collector] Tier 1 collector service listening on :${PORT}`)
  for (const t of TENANTS) tenantLoop(t)
  heartbeatLoop()
  retentionLoop()
})
