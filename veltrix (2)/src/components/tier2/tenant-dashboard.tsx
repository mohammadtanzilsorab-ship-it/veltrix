'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { HealthResponse, Tenant } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Activity, AlertTriangle, CheckCircle2, Globe2 } from 'lucide-react'

interface TenantDashboardProps {
  tenant: Tenant | undefined
  health: HealthResponse | null
}

const statusToColor: Record<string, string> = {
  healthy: 'text-emerald-600',
  degraded: 'text-amber-600',
  down: 'text-red-600',
}
const statusToBar: Record<string, number> = {
  healthy: 100,
  degraded: 60,
  down: 25,
}

export function TenantDashboard({ tenant, health }: TenantDashboardProps) {
  if (!tenant) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading tenant…
        </CardContent>
      </Card>
    )
  }

  const summary = health?.summary
  const status = summary?.status ?? 'healthy'
  const score = summary?.score ?? 100

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{tenant.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Globe2 className="h-3 w-3" />
              Region {tenant.region} · {tenant.code} · key {tenant.apiKeyMasked}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 border',
              status === 'healthy' && 'border-emerald-300 text-emerald-700',
              status === 'degraded' && 'border-amber-300 text-amber-700',
              status === 'down' && 'border-red-300 text-red-700',
            )}
          >
            {status === 'healthy' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3 w-3" /> Health score
            </span>
            <span className={cn('font-medium tabular-nums', statusToColor[status])}>
              {score}/100
            </span>
          </div>
          <Progress value={statusToBar[status] ?? 100} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Packets 30m" value={summary?.packetsLast30Min ?? 0} />
          <Stat label="Events 30m" value={summary?.totalEventsLast30Min ?? 0} />
          <Stat
            label="Error rate"
            value={`${((summary?.errorRate ?? 0) * 100).toFixed(1)}%`}
            warn={(summary?.errorRate ?? 0) > 0.1}
          />
          <Stat label="p95 ms" value={Math.round(summary?.avgP95 ?? 0)} warn={(summary?.avgP95 ?? 0) > 1500} />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Stat label="Total packets" value={tenant.totalPackets} />
          <Stat label="Anomalies" value={tenant.totalAnomalies} warn={tenant.totalAnomalies > 5} />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
      <div className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-base font-semibold tabular-nums leading-tight', warn ? 'text-amber-600' : 'text-foreground')}>
        {value}
      </div>
    </div>
  )
}
