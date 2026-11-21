'use client'

import { useEffect, useState } from 'react'
import { Server, ShieldCheck, ArrowRight, Cpu, Database, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * DataFlowHero — animated 3D visualization of packets flowing from
 * Tier 1 (customer collector) across the trust boundary into Tier 2 (SaaS).
 *
 * - Two server "boxes" rendered with 3D perspective + neon-green glow.
 * - SVG path connecting them, with a "trust boundary" gate in the middle.
 * - Packets spawn periodically and animate along the path.
 * - ~85% of packets cross successfully (green), ~15% get rejected at the
 *   boundary and bounce back (red) — this mirrors the real HMAC-verify rate.
 * - Counters at the bottom show live running totals.
 */
interface Packet {
  id: number
  rejected: boolean
  // progress 0..1 along the path; >1 means it's done
  progress: number
  speed: number
}

const SPAWN_INTERVAL_MS = 700
const REJECT_PROBABILITY = 0.12
const MAX_PACKETS = 24

export function DataFlowHero() {
  const [packets, setPackets] = useState<Packet[]>([])
  const [stats, setStats] = useState({ sent: 0, delivered: 0, rejected: 0 })

  // Spawn + advance packets
  useEffect(() => {
    let nextId = 1
    const spawn = setInterval(() => {
      const rejected = Math.random() < REJECT_PROBABILITY
      setPackets(prev => {
        const next = [
          ...prev,
          { id: nextId++, rejected, progress: 0, speed: 0.006 + Math.random() * 0.004 },
        ]
        // Cap so we don't overflow
        return next.length > MAX_PACKETS ? next.slice(-MAX_PACKETS) : next
      })
      setStats(s => ({ ...s, sent: s.sent + 1 }))
    }, SPAWN_INTERVAL_MS)

    const tick = setInterval(() => {
      setPackets(prev => {
        const next: Packet[] = []
        for (const p of prev) {
          const newProgress = p.progress + p.speed
          // Rejected packets "bounce back" at the boundary (progress 0.45)
          if (p.rejected && p.progress < 0.45 && newProgress >= 0.45) {
            // Convert to a return-to-sender trajectory
            next.push({ ...p, progress: 0.45, speed: -p.speed })
            setStats(s => ({ ...s, rejected: s.rejected + 1 }))
            continue
          }
          if (newProgress > 1.05 || newProgress < -0.05) {
            // Packet finished — drop it. If it crossed successfully, count.
            if (!p.rejected && p.progress > 0.5) {
              setStats(s => ({ ...s, delivered: s.delivered + 1 }))
            }
            continue
          }
          next.push({ ...p, progress: newProgress })
        }
        return next
      })
    }, 32)

    return () => {
      clearInterval(spawn)
      clearInterval(tick)
    }
  }, [])

  // Path geometry — cubic bezier from Tier 1 (x=80) to Tier 2 (x=W-80)
  // The path passes through the boundary gate at x=W/2.
  const W = 1000
  const H = 200
  const pathD = `M 80 ${H / 2} C ${W * 0.3} ${H * 0.1}, ${W * 0.7} ${H * 0.9}, ${W - 80} ${H / 2}`

  // Sample a point on the cubic bezier at parametric t (0..1)
  function bezierPoint(t: number) {
    const p0 = { x: 80, y: H / 2 }
    const p1 = { x: W * 0.3, y: H * 0.1 }
    const p2 = { x: W * 0.7, y: H * 0.9 }
    const p3 = { x: W - 80, y: H / 2 }
    const mt = 1 - t
    const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x
    const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    return { x, y }
  }

  const boundaryX = W / 2
  const boundaryY = bezierPoint(0.5).y

  return (
    <div className="veltrix-3d-stage relative w-full">
      <div className="veltrix-3d-tilt relative overflow-hidden rounded-2xl">
        <div className="veltrix-scanlines relative rounded-2xl border border-primary/30 bg-card/60 p-6 backdrop-blur-md sm:p-8">
          {/* Header chips */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <Activity className="h-3 w-3 veltrix-pulse" />
              Live packet flow
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
              <Stat label="sent" value={stats.sent} />
              <Stat label="delivered" value={stats.delivered} tint="text-emerald-400" />
              <Stat label="rejected" value={stats.rejected} tint="text-red-400" />
            </div>
          </div>

          {/* SVG flow stage */}
          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              style={{ height: 'auto', maxHeight: '220px' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Glow path */}
              <path
                d={pathD}
                fill="none"
                stroke="oklch(0.78 0.22 150 / 0.18)"
                strokeWidth="14"
                strokeLinecap="round"
                filter="blur(6px)"
              />
              {/* Solid path */}
              <path
                d={pathD}
                fill="none"
                stroke="oklch(0.78 0.22 150 / 0.35)"
                strokeWidth="1.5"
                strokeDasharray="4 6"
                strokeLinecap="round"
                className="veltrix-pulse"
              />

              {/* Boundary gate — vertical bar with glow */}
              <g transform={`translate(${boundaryX}, 0)`}>
                <rect
                  x="-2"
                  y="0"
                  width="4"
                  height={H}
                  fill="oklch(0.78 0.22 150 / 0.2)"
                  filter="blur(2px)"
                />
                <rect x="-1" y="0" width="2" height={H} fill="oklch(0.78 0.22 150 / 0.6)" />
                <text
                  x="0"
                  y={H - 4}
                  textAnchor="middle"
                  fill="oklch(0.78 0.22 150 / 0.7)"
                  fontSize="9"
                  fontFamily="monospace"
                  letterSpacing="2"
                >
                  BOUNDARY
                </text>
              </g>

              {/* Packets */}
              {packets.map(p => {
                const pt = bezierPoint(Math.max(0, Math.min(1, p.progress)))
                const isReturning = p.speed < 0
                const color = p.rejected ? 'oklch(0.65 0.25 25)' : 'oklch(0.85 0.22 150)'
                const glowColor = p.rejected ? 'oklch(0.65 0.25 25 / 0.5)' : 'oklch(0.85 0.22 150 / 0.6)'
                return (
                  <g key={p.id} transform={`translate(${pt.x}, ${pt.y})`}>
                    {/* Glow halo */}
                    <circle r="9" fill={glowColor} filter="blur(4px)" />
                    {/* Packet core */}
                    <circle r="3.5" fill={color} />
                    {/* Trail */}
                    {!isReturning && (
                      <circle
                        r="2"
                        fill={color}
                        opacity="0.5"
                        transform={`translate(${-Math.sign(p.speed) * 6}, 0)`}
                      />
                    )}
                    {/* Reject flash at boundary */}
                    {p.rejected && Math.abs(p.progress - 0.45) < 0.05 && (
                      <circle
                        r="14"
                        fill="none"
                        stroke="oklch(0.65 0.25 25)"
                        strokeWidth="1"
                        opacity="0.6"
                        className="veltrix-pulse"
                      />
                    )}
                  </g>
                )
              })}

              {/* Tier 1 server (left) */}
              <ServerNode
                x={80}
                y={H / 2}
                label="TIER 1"
                sublabel="collector"
                color="oklch(0.78 0.22 150)"
              />

              {/* Tier 2 server (right) */}
              <ServerNode
                x={W - 80}
                y={H / 2}
                label="TIER 2"
                sublabel="central SaaS"
                color="oklch(0.78 0.22 150)"
              />

              {/* Trust boundary badge in center top */}
              <g transform={`translate(${boundaryX}, 24)`}>
                <rect
                  x="-42"
                  y="-12"
                  width="84"
                  height="24"
                  rx="12"
                  fill="oklch(0.11 0.018 165 / 0.95)"
                  stroke="oklch(0.78 0.22 150 / 0.5)"
                  strokeWidth="1"
                />
                <ShieldCheck x="-9" y="-7" width="14" height="14" stroke="oklch(0.85 0.22 150)" strokeWidth="1.5" />
                <text
                  x="6"
                  y="3"
                  textAnchor="middle"
                  fill="oklch(0.85 0.22 150)"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  TRUST
                </text>
              </g>
            </svg>
          </div>

          {/* Bottom labels + mechanisms */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FlowCard
              icon={<Cpu className="h-3.5 w-3.5" />}
              title="Tier 1 · Customer Environment"
              lines={[
                'Raw logs · IPs · keys · payloads',
                '6-step pipeline runs locally',
                'Signs HMAC-SHA256, queues outbox',
              ]}
            />
            <FlowCard
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              title="Trust Boundary"
              lines={[
                'TLS 1.3 · X-API-Key · HMAC verify',
                'Raw data never crosses',
                `${Math.round((1 - REJECT_PROBABILITY) * 100)}% of packets pass through`,
              ]}
              center
            />
            <FlowCard
              icon={<Database className="h-3.5 w-3.5" />}
              title="Tier 2 · Central SaaS"
              lines={[
                'Metadata only — persisted to DB',
                'Health engine + AIOps engine',
                'Reconciles every packet by UUID',
              ]}
              right
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ServerNode({
  x,
  y,
  label,
  sublabel,
  color,
}: {
  x: number
  y: number
  label: string
  sublabel: string
  color: string
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow */}
      <rect x="-32" y="-22" width="64" height="44" rx="6" fill={color} opacity="0.15" filter="blur(8px)" />
      {/* Server box */}
      <rect
        x="-28"
        y="-18"
        width="56"
        height="36"
        rx="4"
        fill="oklch(0.11 0.018 165)"
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Server rack lines */}
      <line x1="-22" y1="-10" x2="22" y2="-10" stroke={color} strokeWidth="0.6" opacity="0.5" />
      <line x1="-22" y1="-4" x2="22" y2="-4" stroke={color} strokeWidth="0.6" opacity="0.5" />
      <line x1="-22" y1="2" x2="22" y2="2" stroke={color} strokeWidth="0.6" opacity="0.5" />
      <line x1="-22" y1="8" x2="22" y2="8" stroke={color} strokeWidth="0.6" opacity="0.5" />
      {/* Status LED */}
      <circle cx="20" cy="-12" r="1.5" fill={color} className="veltrix-pulse" />
      {/* Labels */}
      <text x="0" y="-26" textAnchor="middle" fill={color} fontSize="10" fontFamily="monospace" fontWeight="700">
        {label}
      </text>
      <text x="0" y="32" textAnchor="middle" fill="oklch(0.6 0.04 165)" fontSize="8" fontFamily="monospace">
        {sublabel}
      </text>
    </g>
  )
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums font-semibold', tint ?? 'text-foreground')}>{value}</span>
    </span>
  )
}

function FlowCard({
  icon,
  title,
  lines,
  center,
  right,
}: {
  icon: React.ReactNode
  title: string
  lines: string[]
  center?: boolean
  right?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary/20 bg-card/60 p-3 backdrop-blur-sm',
        center && 'border-primary/40 veltrix-glow-soft',
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
        {icon}
        {title}
      </div>
      <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-1">
            <ArrowRight className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 text-primary/60', right && 'rotate-0')} />
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
