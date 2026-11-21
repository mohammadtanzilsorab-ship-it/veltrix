'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Wand2,
  EyeOff,
  Sigma,
  Search,
  ShieldCheck,
  Send,
  HeartPulse,
} from 'lucide-react'
import type { PipelineEvent, PipelineStep, SourceType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PipelineViewProps {
  events: PipelineEvent[]
  tenantCode: string
}

const STEPS: { step: PipelineStep; label: string; icon: typeof Download; description: string }[] = [
  { step: 'collect', label: 'Collect', icon: Download, description: 'Simulated telemetry stream from app servers, network devices, security sources' },
  { step: 'normalize', label: 'Normalize', icon: Wand2, description: 'Parse methods, status, latency from raw log strings' },
  { step: 'mask', label: 'Mask PII', icon: EyeOff, description: 'Hash hosts, bucket IPs to /24, reduce users to role class' },
  { step: 'aggregate', label: 'Aggregate', icon: Sigma, description: 'Roll up to per-source event/error counts, p95 latency' },
  { step: 'local-detect', label: 'Local Detect', icon: Search, description: 'Anomaly findings stay in customer environment' },
  { step: 'policy', label: 'Apply Policy', icon: ShieldCheck, description: 'Build allowlisted metadata packet — raw logs excluded' },
]

const SOURCE_COLORS: Record<SourceType, string> = {
  'app-server': 'bg-sky-100 text-sky-700 border-sky-200',
  'network-device': 'bg-violet-100 text-violet-700 border-violet-200',
  'security-source': 'bg-rose-100 text-rose-700 border-rose-200',
}

/**
 * Per-step "last seen" — keeps a snapshot of the most recent event for each
 * pipeline step so the UI can show a live snippet for every step.
 */
function buildStepSnapshots(events: PipelineEvent[], tenantCode: string) {
  const byStep: Partial<Record<PipelineStep, PipelineEvent>> = {}
  for (const ev of events) {
    if (ev.tenantCode !== tenantCode) continue
    if (!byStep[ev.step]) byStep[ev.step] = ev
  }
  // Count recent activity per step (last 60s)
  const counts: Partial<Record<PipelineStep, number>> = {}
  const cutoff = Date.now() - 60_000
  for (const ev of events) {
    if (ev.tenantCode !== tenantCode) continue
    if (ev.ts < cutoff) continue
    counts[ev.step] = (counts[ev.step] ?? 0) + 1
  }
  return { byStep, counts }
}

export function PipelineView({ events, tenantCode }: PipelineViewProps) {
  const { byStep, counts } = buildStepSnapshots(events, tenantCode)
  const lastEgress = byStep.egress
  const lastHeartbeat = byStep.heartbeat

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>Pipeline · 6-step processing</span>
          <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wide">
            local only
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Raw telemetry is collected, normalized, masked, aggregated and locally
          analyzed before the data policy emits an allowlisted metadata packet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, idx) => {
            const ev = byStep[s.step]
            const active = (counts[s.step] ?? 0) > 0
            return (
              <li
                key={s.step}
                className={cn(
                  'rounded-lg border bg-card p-3 transition-colors',
                  active ? 'border-primary/40 bg-accent/30' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <div
                      className={cn(
                        'grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold',
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {idx + 1}
                    </div>
                    <s.icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-xs font-medium leading-tight">{s.label}</span>
                  </div>
                  {active && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.description}</p>
                {ev && (
                  <div className="mt-2 space-y-1">
                    {ev.sourceType && (
                      <span
                        className={cn(
                          'inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium',
                          SOURCE_COLORS[ev.sourceType],
                        )}
                      >
                        {ev.sourceType}
                      </span>
                    )}
                    {ev.rawSnippet && (
                      <pre className="truncate rounded bg-muted/60 px-1.5 py-1 font-mono text-[10px] text-muted-foreground">
                        {ev.rawSnippet}
                      </pre>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
              <Send className="h-3.5 w-3.5" />
              Latest egress (signed metadata)
            </div>
            {lastEgress ? (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs text-emerald-900">{lastEgress.detail}</p>
                {lastEgress.packetId && (
                  <p className="font-mono text-[10px] text-emerald-700">
                    packet: {lastEgress.packetId.slice(0, 13)}…
                    {lastEgress.hmac ? `  hmac: ${lastEgress.hmac.slice(0, 12)}…` : ''}
                  </p>
                )}
                <p className="text-[10px] text-emerald-700">
                  {new Date(lastEgress.ts).toLocaleTimeString()} ·{' '}
                  {lastEgress.ok === false ? 'retry queued' : 'ack received'}
                </p>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-emerald-700">Waiting for first packet…</p>
            )}
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-sky-800">
              <HeartPulse className="h-3.5 w-3.5" />
              Heartbeat
            </div>
            {lastHeartbeat ? (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs text-sky-900">{lastHeartbeat.detail}</p>
                <p className="text-[10px] text-sky-700">
                  {new Date(lastHeartbeat.ts).toLocaleTimeString()} · ok={String(lastHeartbeat.ok ?? false)}
                </p>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-sky-700">Waiting for first heartbeat…</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
