/**
 * useCollectorSocket — connects to the Tier 1 collector's socket.io server
 * and surfaces a rolling buffer of pipeline events.
 *
 * Two connection modes:
 *   1. Local dev (sandbox): no NEXT_PUBLIC_COLLECTOR_URL set → connect via
 *      the Caddy gateway using `/?XTransformPort=3001` (relative URL).
 *   2. Production (Vercel): NEXT_PUBLIC_COLLECTOR_URL is set to the public
 *      collector URL (e.g. https://collector-xyz.up.railway.app) → connect
 *      directly cross-origin. CORS must be allowed by the collector.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { PipelineEvent } from '@/lib/types'

const MAX_EVENTS = 80

const COLLECTOR_URL = process.env.NEXT_PUBLIC_COLLECTOR_URL ?? ''

export interface CollectorState {
  connected: boolean
  events: PipelineEvent[]
  // Per-tenant latest event timestamp, used to drive "active" indicators.
  lastEventByTenant: Record<string, number>
}

export function useCollectorSocket(): CollectorState {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [lastEventByTenant, setLastEventByTenant] = useState<Record<string, number>>({})
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Decide how to connect.
    const socketOpts = {
      path: '/collector-ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    }

    let socket: Socket
    if (COLLECTOR_URL) {
      // Production: connect directly to the public collector URL (cross-origin).
      socket = io(COLLECTOR_URL, socketOpts)
    } else {
      // Local dev: connect via the Caddy gateway using a relative URL + XTransformPort.
      socket = io('/?XTransformPort=3001', socketOpts)
    }
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('pipeline-event', (ev: PipelineEvent) => {
      setEvents(prev => {
        const next = [ev, ...prev]
        if (next.length > MAX_EVENTS) next.length = MAX_EVENTS
        return next
      })
      setLastEventByTenant(prev => ({ ...prev, [ev.tenantCode]: ev.ts }))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  return { connected, events, lastEventByTenant }
}
