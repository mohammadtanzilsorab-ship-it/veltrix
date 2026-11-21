'use client'

import { cn } from '@/lib/utils'
import type { HealthResponse, ReconciliationResponse, Tenant } from '@/lib/types'
import { ArrowDown, ShieldCheck, Radio, Gauge, Database } from 'lucide-react'
import { DataFlowHero } from '@/components/dashboard/data-flow-hero'

interface HeroProps {
  tenants: Tenant[]
  health: HealthResponse | null
  reconcile: ReconciliationResponse | null
  collectorConnected: boolean
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function Hero({ tenants, health, reconcile, collectorConnected }: HeroProps) {
  const totalPackets = tenants.reduce((s, t) => s + t.totalPackets, 0)
  const integrity = reconcile?.summary.integrity ?? '100.00'
  const status = health?.summary.status ?? 'healthy'
  const score = health?.summary.score ?? 100

  return (
    <section
      id="overview"
      className="relative flex min-h-[88vh] flex-col justify-between overflow-hidden border-b border-primary/20 px-5 pb-12 pt-20 sm:px-8 sm:pt-24"
    >
      {/* Ambient green radial glow + grid is now in body bg via globals.css */}

      <div className="relative mx-auto w-full max-w-[1600px]">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/80">
          <span className="veltrix-blink">▍</span>
          <span>VELTRIX</span>
          <span className="h-px w-8 bg-primary/40" />
          <span className="text-muted-foreground">Two-Tier Observability</span>
        </div>

        {/* Headline */}
        <h1 className="mt-6 max-w-5xl text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
          Only allowlisted <br />
          metadata crosses <br />
          <span
            className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent"
            style={{ filter: 'drop-shadow(0 0 12px oklch(0.78 0.22 150 / 0.5))' }}
          >
            the trust boundary.
          </span>
        </h1>

        {/* Subhead */}
        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          A working reference implementation. Tier 1 runs inside the customer network —
          raw logs, keys, IPs and payloads never leave. Tier 2 is the multi-tenant SaaS
          that ingests only signed metadata, runs Health and AIOps engines, and reconciles
          every packet end-to-end.
        </p>

        {/* Animated data-flow visualization — the centerpiece */}
        <div className="mt-12">
          <DataFlowHero />
        </div>

        {/* Compact KPI strip below the viz */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiPill
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Boundary integrity"
            value={`${integrity}%`}
            accent="text-emerald-400"
          />
          <KpiPill
            icon={<Database className="h-3.5 w-3.5" />}
            label="Total packets"
            value={fmt(totalPackets)}
            accent="text-emerald-300"
          />
          <KpiPill
            icon={<Gauge className="h-3.5 w-3.5" />}
            label="Health score"
            value={`${score}/100`}
            accent={status === 'down' ? 'text-red-400' : status === 'degraded' ? 'text-amber-400' : 'text-emerald-400'}
          />
          <KpiPill
            icon={<Radio className="h-3.5 w-3.5" />}
            label="Collector"
            value={collectorConnected ? 'Live' : 'Off'}
            accent={collectorConnected ? 'text-emerald-400' : 'text-amber-400'}
            pulse={collectorConnected}
          />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="relative mt-12 flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-primary/70">
        <ArrowDown className="h-3 w-3 animate-bounce" />
        <span>Scroll to explore the architecture</span>
      </div>
    </section>
  )
}

function KpiPill({
  icon,
  label,
  value,
  accent,
  pulse,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  pulse?: boolean
}) {
  return (
    <div className="veltrix-card relative rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {pulse ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : (
          <span className={accent}>{icon}</span>
        )}
      </div>
      <div className={cn('mt-1.5 text-xl font-bold tabular-nums leading-none sm:text-2xl', accent)}>
        {value}
      </div>
    </div>
  )
}
