/**
 * useTier2Polling — polls the Tier 2 API for tenant metadata views.
 * Refreshes every 5 seconds so the dashboard reflects new packets as the
 * collector streams them in.
 */
'use client'

import { useEffect, useState } from 'react'
import type {
  AIOpsResponse,
  EgressProofResponse,
  HealthResponse,
  LocalUiResponse,
  ReconciliationResponse,
  Tenant,
} from '@/lib/types'

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export interface Tier2State {
  tenants: Tenant[]
  health: HealthResponse | null
  aiops: AIOpsResponse | null
  reconcile: ReconciliationResponse | null
  egressProof: EgressProofResponse | null
  localUi: LocalUiResponse | null
  loading: boolean
  refresh: () => void
}

export function useTier2Polling(tenantCode: string): Tier2State {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [aiops, setAiops] = useState<AIOpsResponse | null>(null)
  const [reconcile, setReconcile] = useState<ReconciliationResponse | null>(null)
  const [egressProof, setEgressProof] = useState<EgressProofResponse | null>(null)
  const [localUi, setLocalUi] = useState<LocalUiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refresh = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false

    async function loadAll() {
      const [t, h, a, r, e, l] = await Promise.all([
        getJson<{ tenants: Tenant[] }>('/api/tenants'),
        getJson<HealthResponse>(`/api/health?tenant=${tenantCode}&limit=20`),
        getJson<AIOpsResponse>(`/api/aiops?tenant=${tenantCode}&limit=30`),
        getJson<ReconciliationResponse>(`/api/reconcile?tenant=${tenantCode}&limit=20`),
        getJson<EgressProofResponse>(`/api/egress-proof?tenant=${tenantCode}`),
        getJson<LocalUiResponse>(`/api/local-ui?tenant=${tenantCode}&limit=15`),
      ])
      if (cancelled) return
      setTenants(t?.tenants ?? [])
      setHealth(h)
      setAiops(a)
      setReconcile(r)
      setEgressProof(e)
      setLocalUi(l)
      setLoading(false)
    }

    loadAll()
    const id = setInterval(loadAll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tenantCode, tick])

  return { tenants, health, aiops, reconcile, egressProof, localUi, loading, refresh }
}

/**
 * Acknowledge or remediate an anomaly.
 */
export async function actOnAnomaly(
  id: string,
  action: 'acknowledge' | 'remediate',
  remediation?: string,
): Promise<boolean> {
  try {
    const r = await fetch('/api/aiops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, remediation }),
    })
    return r.ok
  } catch {
    return false
  }
}
