'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Lock,
  ArrowRight,
  FileLock2,
  KeyRound,
  Network,
  UserX,
  Database,
  Search,
  Activity,
  Globe2,
  Inbox,
  Scale,
} from 'lucide-react'

const STAYS_LOCAL = [
  { icon: Database, label: 'Raw logs', note: '7-day rolling, never egress' },
  { icon: KeyRound, label: 'API keys & secrets', note: 'customer vault only' },
  { icon: Network, label: 'IP addresses', note: 'only /24 buckets cross' },
  { icon: UserX, label: 'Usernames & payloads', note: 'reduced to role class' },
  { icon: Search, label: 'Local detections', note: 'findings stay on-prem' },
]

const CROSSES = [
  { icon: Globe2, label: 'Tenant code & region', note: 'tenant-a · EU' },
  { icon: Activity, label: 'Source type', note: 'app / network / security' },
  { icon: Scale, label: 'Aggregated counts', note: 'events, errors, hosts' },
  { icon: Inbox, label: 'p95 latency', note: 'no individual samples' },
  { icon: FileLock2, label: 'HMAC signature', note: 'sha256 over canonical JSON' },
]

const MECHANISMS = ['TLS 1.3', 'X-API-Key', 'HMAC-SHA256', 'SQLite outbox']

export function TrustBoundary() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
      {/* Stays local */}
      <Card className="relative overflow-hidden rounded-2xl border-rose-200 bg-rose-50/40 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-rose-700">
              Stays in Tier 1
            </div>
            <h3 className="mt-1 text-2xl font-bold text-rose-900 sm:text-3xl">
              Never crosses.
            </h3>
          </div>
          <Lock className="h-7 w-7 text-rose-500" />
        </div>
        <ul className="mt-6 space-y-3">
          {STAYS_LOCAL.map(item => (
            <li key={item.label} className="flex items-start gap-3 rounded-lg bg-background/70 p-3">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-rose-900">{item.label}</div>
                <div className="text-xs text-rose-700">{item.note}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Center column — mechanisms */}
      <div className="flex flex-row items-center justify-center gap-4 lg:flex-col lg:gap-3 lg:px-2">
        <div className="hidden flex-col items-center gap-3 lg:flex">
          <ArrowRight className="h-6 w-6 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            crosses via
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 lg:flex-col">
          {MECHANISMS.map(m => (
            <Badge
              key={m}
              variant="outline"
              className="border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary"
            >
              {m}
            </Badge>
          ))}
        </div>
        <div className="hidden flex-col items-center gap-3 lg:flex">
          <ArrowRight className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Crosses to Tier 2 */}
      <Card className="relative overflow-hidden rounded-2xl border-emerald-200 bg-emerald-50/40 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
              Crosses to Tier 2
            </div>
            <h3 className="mt-1 text-2xl font-bold text-emerald-900 sm:text-3xl">
              Metadata only.
            </h3>
          </div>
          <ArrowRight className="h-7 w-7 text-emerald-500" />
        </div>
        <ul className="mt-6 space-y-3">
          {CROSSES.map(item => (
            <li key={item.label} className="flex items-start gap-3 rounded-lg bg-background/70 p-3">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-emerald-900">{item.label}</div>
                <div className="text-xs text-emerald-700">{item.note}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
