/**
 * Notification helper — central place where the "main system gets warned"
 * when something goes wrong in any connected system.
 *
 * Every error path in the ingest pipeline, heartbeat monitor, health engine
 * and AIOps engine calls into here so the operator sees a unified alert in
 * the bell dropdown — instead of having to scrape anomalies / recon / health
 * tabs separately.
 */
import { db } from '@/lib/db'

export type NotificationSeverity = 'info' | 'warning' | 'critical'
export type NotificationSource =
  | 'ingest-api'
  | 'heartbeat-monitor'
  | 'health-engine'
  | 'aiops-engine'
  | 'reconciliation'

interface EmitParams {
  tenantId?: string
  severity: NotificationSeverity
  sourceSystem: NotificationSource | string
  title: string
  message: string
  relatedAnomalyId?: string
  relatedPacketId?: string
  /** De-dup key — if an active notification with the same source+dedupKey exists,
   *  we bump its message+timestamp instead of inserting a duplicate. */
  dedupKey?: string
}

export async function emitNotification(params: EmitParams): Promise<void> {
  const {
    tenantId,
    severity,
    sourceSystem,
    title,
    message,
    relatedAnomalyId,
    relatedPacketId,
    dedupKey,
  } = params

  // De-dup: if there's already an ACTIVE notification for the same source + dedupKey,
  // update it instead of creating a duplicate. This keeps the bell count finite
  // even when the collector is spamming error-bursts every few seconds.
  if (dedupKey) {
    const existing = await db.notification.findFirst({
      where: {
        status: 'active',
        sourceSystem,
        // SQLite doesn't have a dedicated dedupKey column — we encode it in title
        // to keep the schema portable. Match on title prefix.
        title: { startsWith: dedupKey },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    if (existing) {
      await db.notification.update({
        where: { id: existing.id },
        data: {
          message,
          severity, // upgrade severity if it got worse
          relatedAnomalyId: relatedAnomalyId ?? existing.relatedAnomalyId,
          relatedPacketId: relatedPacketId ?? existing.relatedPacketId,
          // Reset acknowledged state if a new occurrence comes in.
          status: existing.status === 'acknowledged' ? 'active' : existing.status,
          acknowledgedAt: null,
        },
      })
      return
    }
  }

  await db.notification.create({
    data: {
      tenantId: tenantId ?? null,
      severity,
      sourceSystem,
      title: dedupKey ? `${dedupKey} · ${title}` : title,
      message,
      relatedAnomalyId: relatedAnomalyId ?? null,
      relatedPacketId: relatedPacketId ?? null,
      status: 'active',
    },
  })
}

/**
 * Lazy heartbeat-stale check — called on every /api/notifications GET.
 * For each tenant, look at the most recent heartbeat health metric. If it's
 * older than the threshold, emit (or refresh) a "collector silent" notification.
 *
 * This is the "warn the main system if errors occur in connected systems"
 * guarantee — even if no packet arrives, the silence itself is surfaced.
 */
export async function detectStaleHeartbeats(thresholdMs: number = 30_000): Promise<void> {
  const tenants = await db.tenant.findMany()
  for (const t of tenants) {
    const lastBeat = await db.healthMetric.findFirst({
      where: { tenantId: t.id, pipelineStep: 'heartbeat' },
      orderBy: { timestamp: 'desc' },
      take: 1,
    })
    if (!lastBeat) {
      // Never received a heartbeat from this tenant's collector at all.
      await emitNotification({
        tenantId: t.id,
        severity: 'warning',
        sourceSystem: 'heartbeat-monitor',
        title: `collector:${t.code} never seen`,
        message: `No heartbeat has ever been received from the ${t.code} (${t.region}) collector. Verify the collector service is running and can reach the ingest endpoint.`,
        dedupKey: `collector-silent:${t.code}`,
      })
      continue
    }
    const ageMs = Date.now() - lastBeat.timestamp.getTime()
    if (ageMs > thresholdMs) {
      const ageSec = Math.round(ageMs / 1000)
      await emitNotification({
        tenantId: t.id,
        severity: ageMs > thresholdMs * 3 ? 'critical' : 'warning',
        sourceSystem: 'heartbeat-monitor',
        title: `collector:${t.code} silent`,
        message: `Last heartbeat from ${t.code} (${t.region}) was ${ageSec}s ago. The collector may have crashed, lost network, or had its HMAC secret rotated without updating Tier 2.`,
        dedupKey: `collector-silent:${t.code}`,
      })
    } else {
      // Heartbeat is fresh — auto-resolve any existing "collector silent" notification.
      const existing = await db.notification.findFirst({
        where: {
          status: { in: ['active', 'acknowledged'] },
          sourceSystem: 'heartbeat-monitor',
          tenantId: t.id,
          title: { startsWith: 'collector-silent' },
        },
      })
      if (existing) {
        await db.notification.update({
          where: { id: existing.id },
          data: {
            status: 'resolved',
            resolvedAt: new Date(),
            message: `Heartbeat resumed at ${new Date().toISOString()}. Collector is back online.`,
          },
        })
      }
    }
  }
}
