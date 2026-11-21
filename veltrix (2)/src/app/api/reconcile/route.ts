/**
 * GET /api/reconcile?tenant=<code>&limit=<n>
 *
 * Reconciliation view: every Tier 1 egress packet should have a matching
 * Tier 2 receipt. We surface the records we know about (Tier 2 receipts) plus
 * any packets Tier 1 reported as sent that we never received.
 *
 * Because both tiers share the same packetId UUID, we can join exactly.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureTenantsSeeded } from '@/lib/seed'

export async function GET(req: NextRequest) {
  await ensureTenantsSeeded()
  const tenantCode = req.nextUrl.searchParams.get('tenant') ?? 'tenant-a'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '40', 10)

  const tenant = await db.tenant.findUnique({ where: { code: tenantCode } })
  if (!tenant) return NextResponse.json({ error: 'unknown tenant' }, { status: 404 })

  const records = await db.reconciliationRecord.findMany({
    where: { tenantId: tenant.id },
    orderBy: { tier1SentAt: 'desc' },
    take: limit,
  })

  const delivered = records.filter(r => r.status === 'delivered').length
  const rejected = records.filter(r => r.status === 'rejected').length
  const pending = records.filter(r => r.status === 'pending' || r.status === 'missing').length

  // Latency stats for delivered packets (ms between tier1SentAt and tier2ReceivedAt).
  const latencies = records
    .filter(r => r.status === 'delivered' && r.tier2ReceivedAt)
    .map(r => (r.tier2ReceivedAt!.getTime() - r.tier1SentAt.getTime()))
  const avgLatency = latencies.length ? latencies.reduce((s, n) => s + n, 0) / latencies.length : 0
  const maxLatency = latencies.length ? Math.max(...latencies) : 0

  return NextResponse.json({
    tenant: { code: tenant.code, name: tenant.name, region: tenant.region },
    summary: {
      total: records.length,
      delivered,
      rejected,
      pending,
      avgLatencyMs: +avgLatency.toFixed(1),
      maxLatencyMs: maxLatency,
      integrity: records.length ? ((delivered / records.length) * 100).toFixed(2) : '100.00',
    },
    records: records.map(r => ({
      id: r.id,
      packetId: r.packetId,
      tier1SentAt: r.tier1SentAt,
      tier2ReceivedAt: r.tier2ReceivedAt,
      status: r.status,
      note: r.note,
      latencyMs: r.tier2ReceivedAt ? r.tier2ReceivedAt.getTime() - r.tier1SentAt.getTime() : null,
    })),
  })
}
