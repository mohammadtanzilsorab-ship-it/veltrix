/**
 * POST /api/ingest/heartbeat
 *
 * Tier 1 sends a lightweight heartbeat (no payload data) every ~10s so Tier 2
 * knows the collector is alive. The body is JSON { tenantCode, region, ts }
 * and is HMAC-signed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { findTenantByApiKey, TENANT_KEYS } from '@/lib/tier2-secrets'
import { ensureTenantsSeeded } from '@/lib/seed'

export async function POST(req: NextRequest) {
  await ensureTenantsSeeded()
  const apiKey = req.headers.get('x-api-key') ?? ''
  const signature = req.headers.get('x-signature') ?? ''
  const tenantCode = findTenantByApiKey(apiKey)
  if (!tenantCode) return NextResponse.json({ ok: false }, { status: 401 })
  const cfg = TENANT_KEYS[tenantCode]

  let body: { tenantCode?: string; region?: string; ts?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const expected = createHmac('sha256', cfg.hmacSecret).update(JSON.stringify(body)).digest('hex')
  if (expected !== signature) {
    return NextResponse.json({ ok: false, error: 'signature mismatch' }, { status: 401 })
  }
  const tenant = await db.tenant.findUnique({ where: { code: tenantCode } })
  if (tenant) {
    await db.healthMetric.create({
      data: {
        tenantId: tenant.id,
        status: 'healthy',
        score: 100,
        pipelineStep: 'heartbeat',
        detail: `Heartbeat received from ${tenantCode} (${cfg.region})`,
      },
    })
  }
  return NextResponse.json({ ok: true })
}
