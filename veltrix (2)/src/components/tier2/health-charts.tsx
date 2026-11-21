'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import type { HealthResponse } from '@/lib/types'

interface HealthChartsProps {
  health: HealthResponse | null
}

function fmtTime(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function HealthCharts({ health }: HealthChartsProps) {
  const series = (health?.series ?? []).map(b => ({
    t: fmtTime(b.t),
    events: b.events,
    errors: b.errors,
    p95: Math.round(b.p95),
  }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Health engine · 30-minute trend</CardTitle>
        <CardDescription className="text-xs">
          Recomputed on every ingested packet — error rate, p95 latency, event volume per minute bucket.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="eventsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.13 175)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="oklch(0.55 0.13 175)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="errorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="oklch(0.6 0.22 25)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.008 240)" />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: 'oklch(0.52 0.02 240)' }}
                interval="preserveEnd"
                minTickGap={40}
              />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.52 0.02 240)' }} />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid oklch(0.9 0.008 240)',
                }}
              />
              <Area
                type="monotone"
                dataKey="events"
                stroke="oklch(0.55 0.13 175)"
                fill="url(#eventsGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke="oklch(0.6 0.22 25)"
                fill="url(#errorsGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.008 240)" />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 10, fill: 'oklch(0.52 0.02 240)' }}
                interval="preserveEnd"
                minTickGap={40}
              />
              <YAxis tick={{ fontSize: 10, fill: 'oklch(0.52 0.02 240)' }} />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid oklch(0.9 0.008 240)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="p95" name="p95 ms" fill="oklch(0.7 0.15 75)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Source data: aggregated metadata packets received by the Tier 2 Ingest API in the last 30 minutes.
          Raw event samples are not present — they remain in Tier 1.
        </p>
      </CardContent>
    </Card>
  )
}
