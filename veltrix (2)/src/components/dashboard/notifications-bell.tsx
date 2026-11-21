'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, CircleAlert, TriangleAlert, OctagonAlert, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { NotificationRow, NotificationsResponse } from '@/lib/types'

interface NotificationsBellProps {
  /** Active tenant code — used to show tenant-specific badge in the panel. */
  tenantCode: string
}

// Severity meta — all red-family tints so the panel reads as red-on-black
// while still letting the eye distinguish critical / warning / info.
const SEVERITY_META: Record<string, { icon: typeof Bell; tint: string; ring: string; chipTint: string }> = {
  critical: {
    icon: OctagonAlert,
    tint: 'text-red-400',
    ring: 'ring-red-500/40 bg-red-950/40',
    chipTint: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40',
  },
  warning: {
    icon: TriangleAlert,
    tint: 'text-amber-400',
    ring: 'ring-amber-500/30 bg-amber-950/30',
    chipTint: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  },
  info: {
    icon: CircleAlert,
    tint: 'text-rose-300',
    ring: 'ring-rose-500/25 bg-rose-950/30',
    chipTint: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25',
  },
}

function fmtAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function NotificationsBell({ tenantCode }: NotificationsBellProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  async function load(silent = true) {
    if (!silent) setLoading(true)
    try {
      const r = await fetch('/api/notifications?status=active&limit=30', { cache: 'no-store' })
      if (!r.ok) return
      const next = (await r.json()) as NotificationsResponse
      if (seenIds.size > 0) {
        for (const n of next.notifications) {
          if (!seenIds.has(n.id) && n.severity === 'critical') {
            toast.error(`${n.tenant ? n.tenant.code + ' · ' : ''}${n.title}`, {
              description: n.message.slice(0, 180),
              duration: 8000,
            })
          }
        }
      }
      setSeenIds(new Set(next.notifications.map(n => n.id)))
      setData(next)
    } catch {
      /* ignore */
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    pollRef.current = setInterval(() => load(true), 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function act(id: string, action: 'acknowledge' | 'resolve') {
    try {
      const r = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      toast.success(action === 'acknowledge' ? 'Notification acknowledged' : 'Notification resolved')
      load(true)
    } catch (err: any) {
      toast.error('Action failed', { description: String(err?.message ?? err) })
    }
  }

  const counts = data?.counts ?? { active: 0, critical: 0, warning: 0, info: 0 }
  const notifications = data?.notifications ?? []
  const badge = counts.active
  const criticalBadge = counts.critical

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button — always red-tinted so it reads as the warning control */}
      <button
        onClick={() => {
          setOpen(o => !o)
          if (!open) load(false)
        }}
        aria-label={`Notifications (${badge} active)`}
        aria-expanded={open}
        className={cn(
          'relative grid h-9 w-9 place-items-center rounded-full transition-all',
          badge > 0
            ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
        style={
          badge > 0
            ? {
                boxShadow: '0 0 12px oklch(0.65 0.25 25 / 0.35)',
              }
            : undefined
        }
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
              criticalBadge > 0 ? 'bg-red-500' : 'bg-red-600/80',
            )}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {criticalBadge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-11 z-50 flex max-h-[70vh] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-red-500/40 bg-black shadow-2xl"
          style={{
            boxShadow:
              '0 0 0 1px oklch(0.65 0.25 25 / 0.35), 0 0 32px oklch(0.65 0.25 25 / 0.25), 0 0 64px oklch(0.65 0.25 25 / 0.1)',
          }}
        >
          {/* Header — red-on-black */}
          <div className="flex items-center justify-between border-b border-red-500/30 bg-gradient-to-br from-red-950/40 via-black to-black px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-red-500/15 ring-1 ring-red-500/40">
                <Bell className="h-3.5 w-3.5 text-red-400" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight text-red-100">System alerts</div>
                <div className="text-[10px] uppercase tracking-widest text-red-400/70">
                  Warnings from connected systems · viewing {tenantCode}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-red-400/70 hover:bg-red-950/40 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Severity summary chips */}
          <div className="flex items-center gap-2 border-b border-red-500/20 bg-black px-4 py-2">
            <Chip label="critical" count={counts.critical} tint={SEVERITY_META.critical.chipTint} />
            <Chip label="warning" count={counts.warning} tint={SEVERITY_META.warning.chipTint} />
            <Chip label="info" count={counts.info} tint={SEVERITY_META.info.chipTint} />
            <span className="ml-auto text-[10px] text-red-400/60">
              {loading ? 'refreshing…' : 'refreshes every 5s'}
            </span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto bg-black">
            {notifications.length === 0 ? (
              <div className="grid place-items-center px-4 py-10 text-center">
                <CheckCheck className="mb-2 h-8 w-8 text-red-500/50" />
                <div className="text-sm font-medium text-red-100">No active alerts</div>
                <div className="mt-1 text-xs text-red-400/60">
                  All connected systems are healthy. Errors anywhere will appear here in real time.
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-red-500/15">
                {notifications.map(n => {
                  const meta = SEVERITY_META[n.severity] ?? SEVERITY_META.info
                  const Icon = meta.icon
                  return (
                    <li key={n.id} className={cn('px-4 py-3 ring-1 ring-inset', meta.ring)}>
                      <div className="flex items-start gap-3">
                        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tint)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-red-50">
                              {n.title}
                            </span>
                            {n.tenant && (
                              <span className="shrink-0 rounded border border-red-500/30 bg-red-950/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-300">
                                {n.tenant.code} · {n.tenant.region}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-red-100/80">
                            {n.message}
                          </p>
                          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-red-400/60">
                            <span>{fmtAgo(n.createdAt)}</span>
                            <span>·</span>
                            <span className="font-mono">{n.sourceSystem}</span>
                            {n.status === 'acknowledged' && (
                              <span className="text-amber-400">· acknowledged</span>
                            )}
                          </div>
                          {n.status !== 'resolved' && (
                            <div className="mt-2 flex items-center gap-1.5">
                              {n.status === 'active' && (
                                <button
                                  onClick={() => act(n.id, 'acknowledge')}
                                  className="inline-flex h-6 items-center rounded-md border border-red-500/40 bg-transparent px-2 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-950/40 hover:text-red-200"
                                >
                                  Acknowledge
                                </button>
                              )}
                              <button
                                onClick={() => act(n.id, 'resolve')}
                                className="inline-flex h-6 items-center rounded-md bg-red-500 px-2 text-[10px] font-semibold text-white transition-colors hover:bg-red-400"
                              >
                                Resolve
                              </button>
                              {n.relatedAnomalyId && (
                                <a
                                  href="#insights"
                                  onClick={() => setOpen(false)}
                                  className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-300 hover:underline"
                                >
                                  Investigate <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer accent strip */}
          <div className="border-t border-red-500/20 bg-gradient-to-r from-red-950/30 via-black to-red-950/30 px-4 py-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-red-400/60">
              <span>VELTRIX · alert feed</span>
              <span className="veltrix-blink text-red-500">●</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ label, count, tint }: { label: string; count: number; tint: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        count > 0 ? tint : 'bg-red-950/20 text-red-400/40 ring-1 ring-red-500/15',
      )}
    >
      {label}: {count}
    </span>
  )
}
