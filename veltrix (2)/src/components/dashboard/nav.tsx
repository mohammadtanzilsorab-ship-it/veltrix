'use client'

import { ShieldCheck, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationsBell } from '@/components/dashboard/notifications-bell'

interface NavProps {
  collectorConnected: boolean
  tenantCode: 'tenant-a' | 'tenant-b'
  onTenantChange: (code: 'tenant-a' | 'tenant-b') => void
  region: string
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'tier-1', label: 'Tier 1' },
  { id: 'boundary', label: 'Boundary' },
  { id: 'tier-2', label: 'Tier 2' },
  { id: 'insights', label: 'Insights' },
]

export function Nav({ collectorConnected, tenantCode, onTenantChange, region }: NavProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8">
        {/* Logo */}
        <a href="#overview" className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold uppercase tracking-tight">
            Veltrix
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:inline">
            / Observability
          </span>
        </a>

        {/* Section nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* Tenant switcher + notifications */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'hidden items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest sm:inline-flex',
              collectorConnected ? 'text-emerald-600' : 'text-amber-600',
            )}
          >
            <Radio className="h-3 w-3" />
            {collectorConnected ? 'Live' : 'Reconnect'}
          </span>
          <NotificationsBell tenantCode={tenantCode} />
          <div className="inline-flex rounded-full border border-border bg-card p-0.5">
            {(['tenant-a', 'tenant-b'] as const).map(code => {
              const active = code === tenantCode
              return (
                <button
                  key={code}
                  onClick={() => onTenantChange(code)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all',
                    active
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={active}
                >
                  {code === 'tenant-a' ? `A · EU` : `B · IN`}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </header>
  )
}
