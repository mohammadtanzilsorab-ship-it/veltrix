/**
 * GET  /api/notifications?status=active&limit=30&tenant=<code>
 *   Lists notifications. Defaults to ACTIVE only, most recent first.
 *   Runs detectStaleHeartbeats() first so silence from any connected
 *   collector becomes a notification even if no packet has arrived.
 *
 * POST /api/notifications
 *   Body: { id: string, action: 'acknowledge' | 'resolve' }
 *   Updates a notification's status. Returns the updated row.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureTenantsSeeded } from '@/lib/seed'
import { detectStaleHeartbeats } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  await ensureTenantsSeeded()
  // Lazy heartbeat check — fires "collector silent" notifications if any
  // connected system hasn't been heard from in 30s.
  await detectStaleHeartbeats(30_000)

  const status = req.nextUrl.searchParams.get('status') ?? 'active'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10)
  const tenantCode = req.nextUrl.searchParams.get('tenant')

  let tenantId: string | undefined
  if (tenantCode) {
    const t = await db.tenant.findUnique({ where: { code: tenantCode } })
    if (t) tenantId = t.id
  }

  const where: Record<string, unknown> = {}
  if (status !== 'all') where.status = status
  if (tenantId) where.tenantId = tenantId

  const notifications = await db.notification.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { tenant: { select: { code: true, region: true, name: true } } },
  })

  // Summary counts for the bell badge.
  const all = await db.notification.findMany({
    where: { status: 'active' },
    select: { severity: true, sourceSystem: true, tenantId: true },
  })
  const counts = {
    active: all.length,
    critical: all.filter(n => n.severity === 'critical').length,
    warning: all.filter(n => n.severity === 'warning').length,
    info: all.filter(n => n.severity === 'info').length,
  }

  return NextResponse.json({
    counts,
    notifications: notifications.map(n => ({
      id: n.id,
      severity: n.severity,
      sourceSystem: n.sourceSystem,
      title: n.title,
      message: n.message,
      status: n.status,
      createdAt: n.createdAt,
      acknowledgedAt: n.acknowledgedAt,
      resolvedAt: n.resolvedAt,
      relatedAnomalyId: n.relatedAnomalyId,
      relatedPacketId: n.relatedPacketId,
      tenant: n.tenant
        ? { code: n.tenant.code, region: n.tenant.region, name: n.tenant.name }
        : null,
    })),
  })
}

export async function POST(req: NextRequest) {
  await ensureTenantsSeeded()
  const body = await req.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.notification.findUnique({ where: { id: body.id } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (body.action === 'acknowledge') {
    const updated = await db.notification.update({
      where: { id: body.id },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    })
    return NextResponse.json({ ok: true, notification: updated })
  }
  if (body.action === 'resolve') {
    const updated = await db.notification.update({
      where: { id: body.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    })
    return NextResponse.json({ ok: true, notification: updated })
  }
  if (body.action === 'acknowledge-all') {
    // Bulk acknowledge all active notifications for the same source/tenant.
    const result = await db.notification.updateMany({
      where: {
        status: 'active',
        tenantId: existing.tenantId,
        sourceSystem: existing.sourceSystem,
      },
      data: { status: 'acknowledged', acknowledgedAt: new Date() },
    })
    return NextResponse.json({ ok: true, updated: result.count })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
