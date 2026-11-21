/**
 * One-time seed of the two sample tenants (A / B). Safe to call concurrently —
 * uses upsert so duplicate inserts from parallel requests are idempotent.
 */
import { db } from '@/lib/db'
import { TENANT_KEYS } from '@/lib/tier2-secrets'

export async function ensureTenantsSeeded() {
  for (const [code, cfg] of Object.entries(TENANT_KEYS)) {
    await db.tenant.upsert({
      where: { code },
      create: { code, name: cfg.name, region: cfg.region, apiKey: cfg.apiKey },
      update: {}, // no-op if row already exists
    })
  }
}
