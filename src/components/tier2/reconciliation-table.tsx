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
import { Scale, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { ReconciliationResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ReconciliationTableProps {
  reconcile: ReconciliationResponse | null
}

const statusTint: Record<string, string> = {
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  missing: 'bg-red-100 text-red-700 border-red-200',
}

export function ReconciliationTable({ reconcile }: ReconciliationTableProps) {
  const records = reconcile?.records ?? []
  const summary = reconcile?.summary
  const integrityNum = summary ? Number(summary.integrity) : 100

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Scale className="h-4 w-4 text-primary" /> Reconciliation
            </CardTitle>
            <CardDescription className="text-xs">
              Each Tier 1 egress packet should have a matching Tier 2 receipt with the same packetId.
              Latency = ms between tier1 sentAt and tier2 receivedAt.
            </CardDescription>
          </div>
          {summary && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="gap-1 border-emerald-300 text-[10px] text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> delivered: {summary.delivered}
              </Badge>
              {summary.rejected > 0 && (
                <Badge variant="outline" className="gap-1 border-red-300 text-[10px] text-red-700">
                  <XCircle className="h-3 w-3" /> rejected: {summary.rejected}
                </Badge>
              )}
              {summary.pending > 0 && (
                <Badge variant="outline" className="gap-1 border-amber-300 text-[10px] text-amber-700">
                  <Clock className="h-3 w-3" /> pending: {summary.pending}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Integrity gauge */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Integrity</div>
            <div
              className={cn(
                'mt-1 text-xl font-semibold tabular-nums',
                integrityNum >= 99 ? 'text-emerald-600' : integrityNum >= 90 ? 'text-amber-600' : 'text-red-600',
              )}
            >
              {summary?.integrity ?? '100.00'}%
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total records</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{summary?.total ?? 0}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg latency</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{summary?.avgLatencyMs ?? 0} ms</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Max latency</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{summary?.maxLatencyMs ?? 0} ms</div>
          </div>
        </div>

        {/* Records table */}
        <div className="max-h-[360px] w-full overflow-y-auto rounded-md border border-border/60">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-[150px]">Packet ID</TableHead>
                <TableHead className="w-[150px]">Tier 1 sent</TableHead>
                <TableHead className="w-[150px]">Tier 2 received</TableHead>
                <TableHead className="w-[90px]">Latency</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No reconciliation records yet.
                  </TableCell>
                </TableRow>
              ) : (
                records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[10px]">{r.packetId.slice(0, 13)}…</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {new Date(r.tier1SentAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {r.tier2ReceivedAt ? new Date(r.tier2ReceivedAt).toLocaleTimeString() : '—'}
                    </TableCell>
                    <TableCell className={cn('text-[11px] tabular-nums', r.latencyMs === null && 'text-muted-foreground')}>
                      {r.latencyMs === null ? '—' : `${r.latencyMs} ms`}
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize', statusTint[r.status] ?? 'bg-muted text-muted-foreground')}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{r.note}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
