/**
 * GET /api/tenants — list all tenants with their last packet summary.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureTenantsSeeded } from '@/lib/seed'

export async function GET() {
  await ensureTenantsSeeded()
  const tenants = await db.tenant.findMany({
    include: {
      packets: { orderBy: { receivedAt: 'desc' }, take: 1 },
      _count: { select: { packets: true, anomalies: true } },
    },
    orderBy: { code: 'asc' },
  })
  return NextResponse.json({
    tenants: tenants.map(t => ({
      code: t.code,
      name: t.name,
      region: t.region,
      apiKeyMasked: t.apiKey.replace(/_(\w{4})$/, '_****'),
      lastPacketAt: t.packets[0]?.receivedAt ?? null,
      totalPackets: t._count.packets,
      totalAnomalies: t._count.anomalies,
    })),
  })
}
