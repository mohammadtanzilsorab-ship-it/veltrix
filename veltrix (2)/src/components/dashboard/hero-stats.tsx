'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Database, ShieldCheck, Gauge, HeartPulse } from 'lucide-react'
import type { HealthResponse, ReconciliationResponse, Tenant } from '@/lib/types'
import { cn } from '@/lib/utils'

interface HeroStatsProps {
  tenants: Tenant[]
  health: HealthResponse | null
  reconcile: ReconciliationResponse | null
  collectorConnected: boolean
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const statusColor: Record<string, string> = {
  healthy: 'text-emerald-600',
  degraded: 'text-amber-600',
  down: 'text-red-600',
}

export function HeroStats({ tenants, health, reconcile, collectorConnected }: HeroStatsProps) {
  const totalPackets = tenants.reduce((s, t) => s + t.totalPackets, 0)
  const totalAnomalies = tenants.reduce((s, t) => s + t.totalAnomalies, 0)
  const integrity = reconcile?.summary.integrity ?? '100.00'
  const score = health?.summary.score ?? 100
  const status = health?.summary.status ?? 'healthy'

  const cards = [
    {
      label: 'Total egress packets',
      value: formatNumber(totalPackets),
      sub: 'metadata received across both regions',
      icon: Database,
      accent: 'text-primary',
    },
    {
      label: 'Boundary integrity',
      value: `${integrity}%`,
      sub: 'packets delivered with valid HMAC',
      icon: ShieldCheck,
      accent: 'text-emerald-600',
    },
    {
      label: 'Health score',
      value: `${score}/100`,
      sub: `status: ${status}`,
      icon: Gauge,
      accent: statusColor[status] ?? 'text-emerald-600',
    },
    {
      label: 'Collector heartbeat',
      value: collectorConnected ? 'Alive' : 'Reconnecting',
      sub: collectorConnected ? 'tier 1 streaming live' : 'socket.io reconnecting',
      icon: HeartPulse,
      accent: collectorConnected ? 'text-emerald-600' : 'text-amber-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map(c => (
        <Card key={c.label} className="overflow-hidden">
          <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
              <c.icon className={cn('h-4 w-4', c.accent)} />
            </div>
            <div className={cn('text-2xl font-semibold leading-none sm:text-3xl', c.accent)}>
              {c.value}
            </div>
            <span className="text-xs text-muted-foreground">{c.sub}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
