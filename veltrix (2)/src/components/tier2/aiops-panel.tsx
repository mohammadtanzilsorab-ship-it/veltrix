'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Bot, ShieldAlert, Check, Clock, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { actOnAnomaly } from '@/hooks/use-tier2-polling'
import type { AIOpsResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AIOpsPanelProps {
  aiops: AIOpsResponse | null
  onRefresh: () => void
}

const severityTint: Record<string, string> = {
  low: 'bg-sky-100 text-sky-700 border-sky-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
}
const statusTint: Record<string, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-amber-50 text-amber-700 border-amber-200',
  remediated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function AIOpsPanel({ aiops, onRefresh }: AIOpsPanelProps) {
  const counts = aiops?.counts ?? { low: 0, medium: 0, high: 0, critical: 0 }
  const anomalies = aiops?.anomalies ?? []

  async function handleAction(id: string, action: 'acknowledge' | 'remediate') {
    const ok = await actOnAnomaly(id, action)
    if (ok) {
      toast.success(
        action === 'acknowledge' ? 'Anomaly acknowledged' : 'Simulated remediation applied',
        { description: action === 'remediate' ? 'Isolated host, restarted service, scaled +2 replicas' : undefined },
      )
      onRefresh()
    } else {
      toast.error('Action failed — see dev log')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Bot className="h-4 w-4 text-primary" /> AIOps engine
            </CardTitle>
            <CardDescription className="text-xs">
              Heuristic anomaly detection over metadata. Each anomaly can be acknowledged or remediated.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['critical', 'high', 'medium', 'low'] as const).map(s => (
              <Badge key={s} variant="outline" className={cn('gap-1 text-[10px]', severityTint[s])}>
                <ShieldAlert className="h-3 w-3" />
                {s}: {counts[s] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[360px] w-full overflow-y-auto rounded-md border border-border/60">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-[100px]">Severity</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                    No anomalies detected yet.
                  </TableCell>
                </TableRow>
              ) : (
                anomalies.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase', severityTint[a.severity])}>
                        {a.severity}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{a.type}</TableCell>
                    <TableCell className="text-xs">
                      <div>{a.description}</div>
                      {a.remediation && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-700">
                          <Sparkles className="h-3 w-3" /> {a.remediation}
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(a.detectedAt).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize', statusTint[a.status])}>
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {a.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => handleAction(a.id, 'acknowledge')}
                          >
                            <Check className="h-3 w-3" /> Ack
                          </Button>
                        )}
                        {a.status !== 'remediated' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => handleAction(a.id, 'remediate')}
                          >
                            <Sparkles className="h-3 w-3" /> Remediate
                          </Button>
                        )}
                      </div>
                    </TableCell>
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
