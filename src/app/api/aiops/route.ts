/**
 * GET  /api/aiops?tenant=<code>       — list recent anomalies
 * POST /api/aiops                     — acknowledge or remediate an anomaly
 *
 * Body for POST: { id: string, action: 'acknowledge' | 'remediate', remediation?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureTenantsSeeded } from '@/lib/seed'

export async function GET(req: NextRequest) {
  await ensureTenantsSeeded()
  const tenantCode = req.nextUrl.searchParams.get('tenant') ?? 'tenant-a'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10)

  const tenant = await db.tenant.findUnique({ where: { code: tenantCode } })
  if (!tenant) return NextResponse.json({ error: 'unknown tenant' }, { status: 404 })

  const anomalies = await db.anomalyEvent.findMany({
    where: { tenantId: tenant.id },
    orderBy: { detectedAt: 'desc' },
    take: limit,
  })

  // Severity breakdown for the dashboard.
  const counts = { low: 0, medium: 0, high: 0, critical: 0 }
  for (const a of anomalies) {
    if (counts[a.severity as keyof typeof counts] !== undefined) counts[a.severity as keyof typeof counts]++
  }
  const open = anomalies.filter(a => a.status === 'open').length
  const remediated = anomalies.filter(a => a.status === 'remediated').length

  return NextResponse.json({
    tenant: { code: tenant.code, name: tenant.name },
    counts,
    openCount: open,
    remediatedCount: remediated,
    anomalies: anomalies.map(a => ({
      id: a.id,
      detectedAt: a.detectedAt,
      severity: a.severity,
      type: a.type,
      description: a.description,
      status: a.status,
      remediation: a.remediation,
    })),
  })
}

export async function POST(req: NextRequest) {
  await ensureTenantsSeeded()
  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const anomaly = await db.anomalyEvent.findUnique({ where: { id: body.id } })
  if (!anomaly) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (body.action === 'acknowledge') {
    const updated = await db.anomalyEvent.update({
      where: { id: body.id },
      data: { status: 'acknowledged' },
    })
    return NextResponse.json({ ok: true, anomaly: updated })
  }
  if (body.action === 'remediate') {
    const remediation =
      body.remediation ??
      `Simulated remediation: isolated affected host, restarted service, scaled +2 replicas`
    const updated = await db.anomalyEvent.update({
      where: { id: body.id },
      data: { status: 'remediated', remediation },
    })
    return NextResponse.json({ ok: true, anomaly: updated })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
