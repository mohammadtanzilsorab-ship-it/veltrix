/**
 * GET /api/egress-proof?tenant=<code>
 *
 * Tier 2 operator view of Tier 1's egress proof board. Server-side fetch hits
 * the collector's HTTP `/local-state` endpoint directly — the browser cannot
 * reach Tier 1 (SaaS → Tier 1 is never exposed to end users in production).
 *
 * This is intentionally a READ-ONLY proxy: Tier 2 cannot reach raw logs or
 * local detections — the collector deliberately only exposes the outbox
 * summary, raw log counts (not contents), and heartbeat history.
 */
import { NextRequest, NextResponse } from 'next/server'

const COLLECTOR_BASE = process.env.COLLECTOR_BASE || 'http://localhost:3001'

export async function GET(req: NextRequest) {
  const tenant = req.nextUrl.searchParams.get('tenant') ?? 'all'
  const url = `${COLLECTOR_BASE}/local-state?tenant=${encodeURIComponent(tenant)}`
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `collector responded ${r.status}` },
        { status: 502 },
      )
    }
    const data = await r.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `collector unreachable: ${err?.message ?? err}` },
      { status: 502 },
    )
  }
}
