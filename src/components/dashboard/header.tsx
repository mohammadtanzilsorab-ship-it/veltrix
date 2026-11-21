'use client'

import { ShieldCheck, Activity, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface HeaderProps {
  collectorConnected: boolean
  tenantCount: number
}

export function Header({ collectorConnected, tenantCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight sm:text-lg">
              VELTRIX
            </h1>
            <p className="text-xs text-muted-foreground">
              Two-Tier Observability · Only allowlisted metadata crosses the trust boundary
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge
            variant="outline"
            className={cn(
              'hidden gap-1.5 sm:inline-flex',
              collectorConnected ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700',
            )}
          >
            <Radio className="h-3 w-3" />
            Tier 1 collector {collectorConnected ? 'live' : 'reconnecting'}
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Activity className="h-3 w-3" />
            {tenantCount} tenants
          </Badge>
        </div>
      </div>
    </header>
  )
}
