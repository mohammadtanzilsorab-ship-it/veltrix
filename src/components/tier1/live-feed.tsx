'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PipelineEvent, PipelineStep } from '@/lib/types'
import { cn } from '@/lib/utils'
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

const STEP_META: Record<PipelineStep, { label: string; icon: typeof Download; tint: string }> = {
  collect: { label: 'Collect', icon: Download, tint: 'bg-sky-50 text-sky-700 border-sky-200' },
  normalize: { label: 'Normalize', icon: Wand2, tint: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  mask: { label: 'Mask', icon: EyeOff, tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  aggregate: { label: 'Aggregate', icon: Sigma, tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  'local-detect': { label: 'Detect', icon: Search, tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  policy: { label: 'Policy', icon: ShieldCheck, tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  egress: { label: 'Egress', icon: Send, tint: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  heartbeat: { label: 'Heartbeat', icon: HeartPulse, tint: 'bg-sky-100 text-sky-800 border-sky-300' },
}

interface LiveFeedProps {
  events: PipelineEvent[]
  tenantCode: string
}

export function LiveFeed({ events, tenantCode }: LiveFeedProps) {
  const filtered = events.filter(e => e.tenantCode === tenantCode)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Live pipeline feed</span>
          <Badge variant="outline" className="gap-1.5 text-[10px] font-normal">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            streaming
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Events from the Tier 1 collector, broadcast via socket.io to the local UI.
          Raw payloads are masked before display.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[420px] w-full overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-2">
          {filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              Waiting for collector events…
            </div>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map(ev => {
                const meta = STEP_META[ev.step]
                const Icon = meta.icon
                return (
                  <li
                    key={ev.id}
                    className="flex items-start gap-2 rounded-md border border-border/40 bg-background p-2 text-xs"
                  >
                    <span className={cn('mt-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium', meta.tint)}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-foreground">{ev.detail}</p>
                      {ev.rawSnippet && (
                        <pre className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          {ev.rawSnippet}
                        </pre>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
