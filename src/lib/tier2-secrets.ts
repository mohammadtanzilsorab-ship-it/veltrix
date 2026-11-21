/**
 * Shared Tier 2 constants — shared secret map for HMAC verification.
 * In production each tenant has its own rotating key managed in a secrets vault;
 * here we mirror the same constants the Tier 1 collector uses.
 */
import { createHmac } from 'crypto'

export const TENANT_KEYS: Record<string, { apiKey: string; hmacSecret: string; region: string; name: string }> = {
  'tenant-a': {
    apiKey: 'ak_live_tenantA_eu_2026',
    hmacSecret: 'sec_live_tenantA_7f3c91a8b2',
    region: 'EU',
    name: 'Tenant A — Acme Industries',
  },
  'tenant-b': {
    apiKey: 'ak_live_tenantB_in_2026',
    hmacSecret: 'sec_live_tenantB_2b8e4d1c90',
    region: 'IN',
    name: 'Tenant B — Northwind Logistics',
  },
}

export function findTenantByApiKey(apiKey: string): string | null {
  for (const [code, cfg] of Object.entries(TENANT_KEYS)) {
    if (cfg.apiKey === apiKey) return code
  }
  return null
}

/**
 * Compute the HMAC-SHA256 over a metadata packet using the same canonical
 * JSON form the Tier 1 collector signs with.
 */
export function signPacket(packet: Record<string, unknown>, secret: string): string {
  const canonical = JSON.stringify(
    Object.keys(packet).sort().reduce((acc, k) => {
      ;(acc as Record<string, unknown>)[k] = (packet as Record<string, unknown>)[k]
      return acc
    }, {}),
  )
  return createHmac('sha256', secret).update(canonical).digest('hex')
}
