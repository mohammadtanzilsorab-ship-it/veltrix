/**
 * Shared TypeScript types for the two-tier observability dashboard.
 */

export type SourceType = 'app-server' | 'network-device' | 'security-source'
export type PipelineStep =
  | 'collect'
  | 'normalize'
  | 'mask'
  | 'aggregate'
  | 'local-detect'
  | 'policy'
  | 'egress'
  | 'heartbeat'

export interface PipelineEvent {
  id: string
  ts: number
  tenantCode: string
  step: PipelineStep
  sourceType?: SourceType
  detail: string
  rawSnippet?: string
  packetId?: string
  hmac?: string
  ok?: boolean
}

export interface Tenant {
  code: string
  name: string
  region: string
  apiKeyMasked: string
  lastPacketAt: string | null
  totalPackets: number
  totalAnomalies: number
}

export interface HealthSummary {
  status: 'healthy' | 'degraded' | 'down'
  score: number
  errorRate: number
  avgP95: number
  avgLatency: number
  packetsLast30Min: number
  totalEventsLast30Min: number
}

export interface HealthBucket {
  t: number
  events: number
  errors: number
  p95: number
}

export interface HealthMetricRow {
  id: string
  ts: string
  status: string
  score: number
  pipelineStep: string
  detail: string
}

export interface HealthResponse {
  tenant: { code: string; name: string; region: string }
  summary: HealthSummary
  series: HealthBucket[]
  metrics: HealthMetricRow[]
}

export interface AnomalyRow {
  id: string
  detectedAt: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  description: string
  status: 'open' | 'acknowledged' | 'remediated'
  remediation: string | null
}

export interface AIOpsResponse {
  tenant: { code: string; name: string }
  counts: Record<'low' | 'medium' | 'high' | 'critical', number>
  openCount: number
  remediatedCount: number
  anomalies: AnomalyRow[]
}

export interface ReconciliationRow {
  id: string
  packetId: string
  tier1SentAt: string
  tier2ReceivedAt: string | null
  status: 'delivered' | 'rejected' | 'pending' | 'missing'
  note: string
  latencyMs: number | null
}

export interface ReconciliationResponse {
  tenant: { code: string; name: string; region: string }
  summary: {
    total: number
    delivered: number
    rejected: number
    pending: number
    avgLatencyMs: number
    maxLatencyMs: number
    integrity: string
  }
  records: ReconciliationRow[]
}

export interface EgressProofOutboxRow {
  packetId: string
  tenantCode: string
  sourceType: string
  region: string
  queuedAt: number
  sentAt: number | null
  ackedAt: number | null
  status: string
}

export interface EgressProofResponse {
  ok: boolean
  tenant: string
  rawLogs: { count: number; retentionDays: string; policy: string }
  localDetections: { count: number; policy: string }
  outbox: EgressProofOutboxRow[]
  heartbeats: { ts: number; tenantCode: string; ok: boolean }[]
}

export interface LocalUiPacket {
  packetId: string
  receivedAt: string
  sourceType: string
  region: string
  eventCount: number
  errorCount: number
  avgLatencyMs: number
  p95LatencyMs: number
  uniqueHosts: number
  hmacSha256: string
  signatureValid: boolean
  maskedPreview: string
}

export interface LocalUiResponse {
  tenant: { code: string; name: string; region: string }
  packets: LocalUiPacket[]
}

// ---------------------------------------------------------------------------
// Notifications — the "warn the main system" feed
// ---------------------------------------------------------------------------

export type NotificationSeverity = 'info' | 'warning' | 'critical'
export type NotificationStatus = 'active' | 'acknowledged' | 'resolved'

export interface NotificationRow {
  id: string
  severity: NotificationSeverity
  sourceSystem: string
  title: string
  message: string
  status: NotificationStatus
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
  relatedAnomalyId: string | null
  relatedPacketId: string | null
  tenant: { code: string; region: string; name: string } | null
}

export interface NotificationsResponse {
  counts: {
    active: number
    critical: number
    warning: number
    info: number
  }
  notifications: NotificationRow[]
}
