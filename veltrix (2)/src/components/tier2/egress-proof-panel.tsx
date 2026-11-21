'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Database, Search, HeartPulse, Inbox, CheckCircle2, Clock4 } from 'lucide-react'
import type { EgressProofResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface EgressProofPanelProps {
  egressProof: EgressProofResponse | null
}

const statusTint: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  queued: 'bg-sky-100 text-sky-700 border-sky-200',
  'pending-retry': 'bg-amber-100 text-amber-700 border-amber-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

export function EgressProofPanel({ egressProof }: EgressProofPanelProps) {
  const outbox = egressProof?.outbox ?? []
  const heartbeats = egressProof?.heartbeats ?? []
  const lastHeartbeat = heartbeats[0]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <Inbox className="h-4 w-4 text-primary" /> Egress proof board
        </CardTitle>
        <CardDescription className="text-xs">
          Read-only view of the Tier 1 collector&apos;s SQLite outbox, raw-log retention counter and heartbeat history.
          Raw log contents are never exposed here — only counts and packet IDs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Database className="h-3 w-3" /> Raw logs (local)
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {egressProof?.rawLogs.count ?? 0}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {egressProof?.rawLogs.retentionDays ?? '0.00'}d retained · {egressProof?.rawLogs.policy ?? ''}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Search className="h-3 w-3" /> Local detections
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {egressProof?.localDetections.count ?? 0}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {egressProof?.localDetections.policy ?? ''}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <HeartPulse className="h-3 w-3" /> Last heartbeat
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xl font-semibold tabular-nums">
              {lastHeartbeat ? (
                <>
                  <span className={lastHeartbeat.ok ? 'text-emerald-600' : 'text-amber-600'}>
                    {lastHeartbeat.ok ? 'OK' : 'Fail'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {lastHeartbeat ? new Date(lastHeartbeat.ts).toLocaleTimeString() : 'pending'}
            </div>
          </div>
        </div>

        {/* Outbox queue */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Outbox queue (last 30 packets)
            </h4>
            <Badge variant="outline" className="text-[10px]">
              SQLite · reliable transport
            </Badge>
          </div>
          <div className="max-h-[280px] w-full overflow-y-auto rounded-md border border-border/60">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-[150px]">Packet ID</TableHead>
                  <TableHead className="w-[110px]">Tenant</TableHead>
                  <TableHead className="w-[120px]">Source</TableHead>
                  <TableHead className="w-[60px]">Region</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[140px]">Timeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outbox.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      Outbox is empty — collector not yet running.
                    </TableCell>
                  </TableRow>
                ) : (
                  outbox.map(o => (
                    <TableRow key={o.packetId}>
                      <TableCell className="font-mono text-[10px]">
                        {o.packetId.slice(0, 13)}…
                      </TableCell>
                      <TableCell className="text-xs">{o.tenantCode}</TableCell>
                      <TableCell className="text-xs">{o.sourceType}</TableCell>
                      <TableCell className="text-xs">{o.region}</TableCell>
                      <TableCell>
                        <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium', statusTint[o.status] ?? 'bg-muted text-muted-foreground')}>
                          {o.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock4 className="h-3 w-3" />
                          q:{' '}
                          {o.queuedAt ? new Date(o.queuedAt).toLocaleTimeString() : '—'}
                        </div>
                        {o.ackedAt && (
                          <div className="flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            ack: {new Date(o.ackedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
