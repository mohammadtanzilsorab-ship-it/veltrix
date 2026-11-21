/**
 * Tier 2 Ingest API — POST /api/ingest
 *
 * Receives a signed metadata packet from a Tier 1 collector and:
 *   1. Authenticates X-API-Key against a known tenant
 *   2. Recomputes HMAC-SHA256 over the canonical packet and compares
 *   3. Persists the metadata only (raw logs never arrive)
 *   4. Triggers Health engine + AIOps engine rollups
 *
 * If signature verification fails the packet is rejected and a row is written
 * to the reconciliation log so the operator can see the breach attempt.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { findTenantByApiKey, TENANT_KEYS } from '@/lib/tier2-secrets'
import { ensureTenantsSeeded } from '@/lib/seed'
import { emitNotification } from '@/lib/notifications'

interface MetadataPacket {
  packetId: string
  tenantCode: string
  sourceType: string
  region: string
  windowStart: number
  eventCount: number
  errorCount: number
  avgLatencyMs: number
  p95LatencyMs: number
  uniqueHosts: number
  eventKinds: string[]
  maskedPreview: string
}

function computeHmac(packet: MetadataPacket, secret: string): string {
  const canonical = JSON.stringify(
    Object.keys(packet).sort().reduce((acc, k) => {
      ;(acc as Record<string, unknown>)[k] = (packet as Record<string, unknown>)[k]
      return acc
    }, {}),
  )
  return createHmac('sha256', secret).update(canonical).digest('hex')
}

export async function POST(req: NextRequest) {
  await ensureTenantsSeeded()

  const apiKey = req.headers.get('x-api-key') ?? ''
  const signature = req.headers.get('x-signature') ?? ''
  const tls = req.headers.get('x-tls') ?? ''

  const tenantCode = findTenantByApiKey(apiKey)
  if (!tenantCode) {
    return NextResponse.json({ ok: false, error: 'unknown api key' }, { status: 401 })
  }
  const cfg = TENANT_KEYS[tenantCode]
  const tenant = await db.tenant.findUnique({ where: { code: tenantCode } })
  if (!tenant) {
    return NextResponse.json({ ok: false, error: 'tenant row missing' }, { status: 500 })
  }

  let packet: MetadataPacket
  try {
    packet = (await req.json()) as MetadataPacket
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  // Verify HMAC. Reject on mismatch.
  const expected = computeHmac(packet, cfg.hmacSecret)
  const valid = expected === signature

  // Persist the packet (signatureValid=false is also recorded so operators
  // can investigate).
  const stored = await db.egressPacket.create({
    data: {
      packetId: packet.packetId,
      tenantId: tenant.id,
      sourceType: packet.sourceType,
      region: packet.region,
      eventCount: packet.eventCount,
      errorCount: packet.errorCount,
      avgLatencyMs: packet.avgLatencyMs,
      p95LatencyMs: packet.p95LatencyMs,
      uniqueHosts: packet.uniqueHosts,
      hmacSha256: signature,
      signatureValid: valid,
      maskedPreview: packet.maskedPreview,
    },
  })

  // Reconciliation: mark the packet as delivered end-to-end.
  await db.reconciliationRecord.create({
    data: {
      tenantId: tenant.id,
      packetId: packet.packetId,
      tier1SentAt: new Date(packet.windowStart),
      tier2ReceivedAt: new Date(),
      status: valid ? 'delivered' : 'rejected',
      note: valid
        ? `HMAC verified · TLS=${tls || 'n/a'} · region=${packet.region}`
        : `HMAC mismatch (received ${signature.slice(0, 12)}…, expected ${expected.slice(0, 12)}…)`,
    },
  })

  if (!valid) {
    // Surface a security anomaly.
    const anomaly = await db.anomalyEvent.create({
      data: {
        tenantId: tenant.id,
        severity: 'critical',
        type: 'signature-mismatch',
        description: `Packet ${packet.packetId.slice(0, 8)} arrived with an invalid HMAC-SHA256 signature — rejected and logged.`,
        status: 'open',
      },
    })
    // Also warn the main system via the unified notification feed.
    await emitNotification({
      tenantId: tenant.id,
      severity: 'critical',
      sourceSystem: 'ingest-api',
      title: 'HMAC signature mismatch',
      message: `Packet ${packet.packetId.slice(0, 8)} from ${tenant.code} (${tenant.region}) failed HMAC verification. Possible tampering or secret rotation mismatch. Rejected.`,
      relatedAnomalyId: anomaly.id,
      relatedPacketId: packet.packetId,
      dedupKey: 'signature-mismatch',
    })
    return NextResponse.json({ ok: false, error: 'signature mismatch', packetId: packet.packetId }, { status: 401 })
  }

  // Health engine — recompute a rolling score from the last 30 minutes.
  const since = new Date(Date.now() - 30 * 60 * 1000)
  const recent = await db.egressPacket.findMany({
    where: { tenantId: tenant.id, receivedAt: { gte: since } },
  })
  const totalEvents = recent.reduce((s, p) => s + p.eventCount, 0) || 1
  const totalErrors = recent.reduce((s, p) => s + p.errorCount, 0)
  const errorRate = totalErrors / totalEvents
  const avgP95 = recent.length ? recent.reduce((s, p) => s + p.p95LatencyMs, 0) / recent.length : 0

  let status = 'healthy'
  let score = 100
  if (errorRate > 0.1 || avgP95 > 1500) {
    status = 'degraded'
    score = 60
  }
  if (errorRate > 0.3 || avgP95 > 3000) {
    status = 'down'
    score = 25
  }
  await db.healthMetric.create({
    data: {
      tenantId: tenant.id,
      status,
      score,
      pipelineStep: packet.sourceType,
      detail: `errorRate=${(errorRate * 100).toFixed(1)}% avgP95=${avgP95.toFixed(0)}ms packets=${recent.length}`,
    },
  })

  // AIOps engine — heuristic anomaly detection on the latest packet.
  if (packet.errorCount >= 5) {
    const anomaly = await db.anomalyEvent.create({
      data: {
        tenantId: tenant.id,
        severity: packet.errorCount >= 8 ? 'high' : 'medium',
        type: 'error-burst',
        description: `${packet.errorCount} errors in ${packet.sourceType} window (packet ${packet.packetId.slice(0, 8)})`,
        status: 'open',
      },
    })
    await emitNotification({
      tenantId: tenant.id,
      severity: packet.errorCount >= 8 ? 'critical' : 'warning',
      sourceSystem: 'aiops-engine',
      title: `Error burst on ${packet.sourceType}`,
      message: `${packet.errorCount} errors in a single ${packet.sourceType} window from ${tenant.code} (${tenant.region}). p95=${packet.p95LatencyMs}ms. Open AIOps engine to remediate.`,
      relatedAnomalyId: anomaly.id,
      relatedPacketId: packet.packetId,
      dedupKey: `error-burst:${tenant.code}:${packet.sourceType}`,
    })
  }
  if (packet.p95LatencyMs > 2000) {
    const anomaly = await db.anomalyEvent.create({
      data: {
        tenantId: tenant.id,
        severity: packet.p95LatencyMs > 3500 ? 'high' : 'medium',
        type: 'latency-spike',
        description: `p95 latency ${packet.p95LatencyMs}ms exceeds 2000ms threshold on ${packet.sourceType}`,
        status: 'open',
      },
    })
    await emitNotification({
      tenantId: tenant.id,
      severity: packet.p95LatencyMs > 3500 ? 'critical' : 'warning',
      sourceSystem: 'aiops-engine',
      title: `Latency spike on ${packet.sourceType}`,
      message: `p95 latency ${packet.p95LatencyMs}ms exceeds the 2000ms threshold on ${packet.sourceType} from ${tenant.code} (${tenant.region}).`,
      relatedAnomalyId: anomaly.id,
      relatedPacketId: packet.packetId,
      dedupKey: `latency-spike:${tenant.code}:${packet.sourceType}`,
    })
  }

  // Health engine notification — only when status transitions to degraded/down.
  if (status !== 'healthy') {
    await emitNotification({
      tenantId: tenant.id,
      severity: status === 'down' ? 'critical' : 'warning',
      sourceSystem: 'health-engine',
      title: `${tenant.code} health: ${status}`,
      message: `Health score ${score}/100 for ${tenant.code} (${tenant.region}). errorRate=${(errorRate * 100).toFixed(1)}% avgP95=${avgP95.toFixed(0)}ms over the last 30 min.`,
      dedupKey: `health-${status}:${tenant.code}`,
    })
  }

  return NextResponse.json({ ok: true, packetId: stored.packetId, status, score })
}
