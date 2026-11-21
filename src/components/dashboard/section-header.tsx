'use client'

import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  index: string // e.g. "01"
  eyebrow: string
  title: string
  description?: string
  accent?: 'rose' | 'emerald' | 'amber' | 'slate'
  id?: string
}

const accentMap = {
  rose: { text: 'text-rose-600', bg: 'bg-rose-500', bar: 'bg-rose-400' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-500', bar: 'bg-emerald-400' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-500', bar: 'bg-amber-400' },
  slate: { text: 'text-foreground', bg: 'bg-foreground', bar: 'bg-border' },
}

export function SectionHeader({
  index,
  eyebrow,
  title,
  description,
  accent = 'slate',
  id,
}: SectionHeaderProps) {
  const a = accentMap[accent]
  return (
    <div id={id} className="scroll-mt-20 border-b border-border pb-6">
      <div className="flex items-baseline gap-4">
        <span className={cn('text-xs font-bold tabular-nums', a.text)}>{index}</span>
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      )}
    </div>
  )
}
