'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Nav } from '@/components/dashboard/nav'
import { Hero } from '@/components/dashboard/hero'
import { SectionHeader } from '@/components/dashboard/section-header'
import { ChatWidget } from '@/components/chatbot/chat-widget'
import { PipelineView } from '@/components/tier1/pipeline-view'
import { LiveFeed } from '@/components/tier1/live-feed'
import { LocalOnlyPanel } from '@/components/tier1/local-only-panel'
import { TrustBoundary } from '@/components/boundary/trust-boundary'
import { TenantDashboard } from '@/components/tier2/tenant-dashboard'
import { HealthCharts } from '@/components/tier2/health-charts'
import { AIOpsPanel } from '@/components/tier2/aiops-panel'
import { EgressProofPanel } from '@/components/tier2/egress-proof-panel'
import { ReconciliationTable } from '@/components/tier2/reconciliation-table'

import { useCollectorSocket } from '@/hooks/use-collector-socket'
import { useTier2Polling } from '@/hooks/use-tier2-polling'

export default function Home() {
  const [tenantCode, setTenantCode] = useState<'tenant-a' | 'tenant-b'>('tenant-a')

  const { connected: collectorConnected, events } = useCollectorSocket()
  const {
    tenants,
    health,
    aiops,
    reconcile,
    egressProof,
    localUi,
    loading,
    refresh,
  } = useTier2Polling(tenantCode)

  const currentTenant = tenants.find(t => t.code === tenantCode)
  const region = currentTenant?.region ?? 'EU'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav
        collectorConnected={collectorConnected}
        tenantCode={tenantCode}
        onTenantChange={setTenantCode}
        region={region}
      />

      <main className="flex-1">
        {/* Hero — full viewport */}
        <Hero
          tenants={tenants}
          health={health}
          reconcile={reconcile}
          collectorConnected={collectorConnected}
        />

        {/* Tier 1 section */}
        <section className="border-b border-border px-5 py-20 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1600px]">
            <SectionHeader
              id="tier-1"
              index="01"
              eyebrow="Customer environment"
              title="Tier 1 — local collector."
              description="A simulated collector runs inside the customer network. Every few seconds it pulls telemetry from app servers, network devices and security sources, then walks a six-step pipeline that ends with an allowlisted metadata packet."
              accent="rose"
            />
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
              <PipelineView events={events} tenantCode={tenantCode} />
              <LiveFeed events={events} tenantCode={tenantCode} />
            </div>
          </div>
        </section>

        {/* Trust boundary section */}
        <section className="border-b border-border bg-muted/20 px-5 py-20 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1600px]">
            <SectionHeader
              id="boundary"
              index="02"
              eyebrow="The gate"
              title="The trust boundary."
              description="Raw data and PII live and die in Tier 1. The only thing that crosses is signed metadata — never raw logs, never keys, never IPs, never usernames, never payloads."
              accent="slate"
            />
            <div className="mt-10">
              <TrustBoundary />
            </div>
          </div>
        </section>

        {/* Tier 2 section */}
        <section className="border-b border-border px-5 py-20 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1600px]">
            <SectionHeader
              id="tier-2"
              index="03"
              eyebrow="Central SaaS platform"
              title="Tier 2 — metadata only."
              description={`The multi-tenant SaaS. The Ingest API verifies the HMAC, persists metadata, and feeds the Health and AIOps engines. Currently viewing ${tenantCode} · ${region}.`}
              accent="emerald"
            />
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
              <TenantDashboard tenant={currentTenant} health={health} />
              <HealthCharts health={health} />
            </div>
          </div>
        </section>

        {/* Insights section — tabbed */}
        <section className="border-b border-border bg-muted/20 px-5 py-20 sm:px-8 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
              <div>
                <div className="flex items-baseline gap-4">
                  <span className="text-xs font-bold tabular-nums text-primary">04</span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Operator insights
                  </span>
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  Inspect every packet.
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Egress proof, anomaly response, end-to-end reconciliation and the customer
                  admin&apos;s local view. Switch tabs to drill into each.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>

            <Tabs defaultValue="egress" className="mt-8 w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="egress" className="text-xs">Egress proof</TabsTrigger>
                <TabsTrigger value="aiops" className="text-xs">AIOps engine</TabsTrigger>
                <TabsTrigger value="reconcile" className="text-xs">Reconciliation</TabsTrigger>
                <TabsTrigger value="local-ui" className="text-xs">Local UI</TabsTrigger>
              </TabsList>

              <TabsContent value="egress" className="mt-6">
                <EgressProofPanel egressProof={egressProof} />
              </TabsContent>
              <TabsContent value="aiops" className="mt-6">
                <AIOpsPanel aiops={aiops} onRefresh={refresh} />
              </TabsContent>
              <TabsContent value="reconcile" className="mt-6">
                <ReconciliationTable reconcile={reconcile} />
              </TabsContent>
              <TabsContent value="local-ui" className="mt-6">
                <LocalOnlyPanel localUi={localUi} />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>

      <footer className="bg-foreground px-5 py-10 text-background sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-bold uppercase tracking-tight">
              VELTRIX
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-background/60">
              Two-Tier Observability · reference implementation
            </div>
          </div>
          <div className="flex items-center gap-6 text-[11px] uppercase tracking-widest text-background/60">
            <span>Tier 1 · collector :3001</span>
            <span>Tier 2 · ingest :3000</span>
          </div>
        </div>
      </footer>

      {/* Floating assistant — context-aware, helps users reduce problems */}
      <ChatWidget
        context={{
          tenantCode,
          region,
          collectorConnected,
          healthStatus: health?.summary.status,
          healthScore: health?.summary.score,
          integrity: reconcile?.summary.integrity,
          totalPackets: tenants.reduce((s, t) => s + t.totalPackets, 0),
          openAnomalies: aiops?.openCount,
        }}
      />
    </div>
  )
}
