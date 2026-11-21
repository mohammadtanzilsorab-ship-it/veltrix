/**
 * GET /api/health?tenant=<code>&limit=<n>
 *
 * Returns the most recent health metrics for a tenant, plus a 30-minute
 * rolling summary.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureTenantsSeeded } from '@/lib/seed'

export async function GET(req: NextRequest) {
  await ensureTenantsSeeded()
  const tenantCode = req.nextUrl.searchParams.get('tenant') ?? 'tenant-a'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)

  const tenant = await db.tenant.findUnique({ where: { code: tenantCode } })
  if (!tenant) return NextResponse.json({ error: 'unknown tenant' }, { status: 404 })

  const since = new Date(Date.now() - 30 * 60 * 1000)
  const [recent, metrics] = await Promise.all([
    db.egressPacket.findMany({
      where: { tenantId: tenant.id, receivedAt: { gte: since } },
      orderBy: { receivedAt: 'desc' },
    }),
    db.healthMetric.findMany({
      where: { tenantId: tenant.id },
      orderBy: { timestamp: 'desc' },
      take: limit,
    }),
  ])

  const totalEvents = recent.reduce((s, p) => s + p.eventCount, 0) || 1
  const totalErrors = recent.reduce((s, p) => s + p.errorCount, 0)
  const errorRate = totalErrors / totalEvents
  const avgP95 = recent.length ? recent.reduce((s, p) => s + p.p95LatencyMs, 0) / recent.length : 0
  const avgLatency = recent.length ? recent.reduce((s, p) => s + p.avgLatencyMs, 0) / recent.length : 0

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

  // Time-series buckets for the last ~30 min (one bucket per minute).
  const buckets: { t: number; events: number; errors: number; p95: number }[] = []
  const now = Date.now()
  for (let i = 29; i >= 0; i--) {
    const start = now - i * 60 * 1000
    const end = start + 60 * 1000
    const inBucket = recent.filter(p => p.receivedAt.getTime() >= start && p.receivedAt.getTime() < end)
    buckets.push({
      t: start,
      events: inBucket.reduce((s, p) => s + p.eventCount, 0),
      errors: inBucket.reduce((s, p) => s + p.errorCount, 0),
      p95: inBucket.length ? inBucket.reduce((s, p) => s + p.p95LatencyMs, 0) / inBucket.length : 0,
    })
  }

  return NextResponse.json({
    tenant: { code: tenant.code, name: tenant.name, region: tenant.region },
    summary: {
      status,
      score,
      errorRate: +errorRate.toFixed(4),
      avgP95: +avgP95.toFixed(2),
      avgLatency: +avgLatency.toFixed(2),
      packetsLast30Min: recent.length,
      totalEventsLast30Min: totalEvents,
    },
    series: buckets,
    metrics: metrics.map(m => ({
      id: m.id,
      ts: m.timestamp,
      status: m.status,
      score: m.score,
      pipelineStep: m.pipelineStep,
      detail: m.detail,
    })),
  })
}
