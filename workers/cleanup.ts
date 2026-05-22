interface Env {
  DB: D1Database
  SITE_CONFIG: KVNamespace
  DNS_WORKER_URL?: string
  DNS_WORKER_SECRET?: string
}

interface DomainRow {
  id: string
  name: string
  status: string
  zoneId: string
  mxRecordIds: string | null
  txtRecordId: string | null
}

const CLEANUP_CONFIG = {
  // Whether to delete expired emails
  DELETE_EXPIRED_EMAILS: true,

  // Whether to delete auto-created subdomains after their emails expire
  DELETE_AUTO_DOMAINS: true,

  // Batch processing size
  BATCH_SIZE: 100,
  DOMAIN_BATCH_SIZE: 20,
} as const

const AUTO_DOMAIN_CLEANUP_GRACE_MS = 30 * 60 * 1000
const PERMANENT_EXPIRY_YEAR = 9999

interface ActiveEmailSummary {
  count: number
  latestExpiresAt: number | null
}

function normalizeDomainName(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "")
}

function parseRecordIds(domain: DomainRow): string[] {
  const recordIds: string[] = []

  if (domain.mxRecordIds) {
    try {
      recordIds.push(...(JSON.parse(domain.mxRecordIds) as string[]))
    } catch {
      console.warn(`Invalid MX record IDs for ${domain.name}`)
    }
  }

  if (domain.txtRecordId) {
    recordIds.push(domain.txtRecordId)
  }

  return recordIds.filter(Boolean)
}

async function setDomainStatus(env: Env, domainId: string, status: string) {
  await env.DB
    .prepare("UPDATE domain SET status = ? WHERE id = ?")
    .bind(status, domainId)
    .run()
}

async function clearDomainRecordIds(env: Env, domainId: string) {
  await env.DB
    .prepare("UPDATE domain SET mx_record_ids = NULL, txt_record_id = NULL WHERE id = ?")
    .bind(domainId)
    .run()
}

function getCleanupAfterFromExpiry(expiresAt: number | null): number | null {
  if (!expiresAt) {
    return null
  }

  if (new Date(expiresAt).getUTCFullYear() >= PERMANENT_EXPIRY_YEAR) {
    return null
  }

  return expiresAt + AUTO_DOMAIN_CLEANUP_GRACE_MS
}

async function setDomainActive(env: Env, domainId: string, cleanupAfter: number | null) {
  await env.DB
    .prepare("UPDATE domain SET status = 'active', cleanup_after = ? WHERE id = ?")
    .bind(cleanupAfter, domainId)
    .run()
}

async function getActiveEmailSummary(env: Env, domainName: string, now: number): Promise<ActiveEmailSummary> {
  const result = await env.DB
    .prepare(`
      SELECT
        COUNT(*) AS count,
        MAX(expires_at) AS latestExpiresAt
      FROM email
      WHERE address LIKE ?
        AND expires_at >= ?
    `)
    .bind(`%@${domainName}`, now)
    .first<{ count: number; latestExpiresAt: number | null }>()

  return {
    count: Number(result?.count ?? 0),
    latestExpiresAt: result?.latestExpiresAt == null ? null : Number(result.latestExpiresAt),
  }
}

async function deleteExpiredEmailsForDomain(env: Env, domainName: string, now: number): Promise<number> {
  const result = await env.DB
    .prepare(`
      DELETE FROM email
      WHERE address LIKE ?
        AND expires_at < ?
    `)
    .bind(`%@${domainName}`, now)
    .run()

  return result.meta?.changes ?? 0
}

async function deprovisionDomainDns(env: Env, domain: DomainRow, recordIds: string[]) {
  if (recordIds.length === 0) {
    return
  }

  if (!env.DNS_WORKER_URL || !env.DNS_WORKER_SECRET) {
    throw new Error("DNS Worker is not configured")
  }

  const response = await fetch(`${env.DNS_WORKER_URL}/deprovision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DNS_WORKER_SECRET}`,
    },
    body: JSON.stringify({
      zoneId: domain.zoneId,
      recordIds,
    }),
  })

  const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || `DNS cleanup failed with status ${response.status}`)
  }
}

async function removeDomainFromKv(env: Env, domainName: string) {
  const currentDomains = await env.SITE_CONFIG.get("EMAIL_DOMAINS")
  if (!currentDomains) return

  const normalizedDomainName = normalizeDomainName(domainName)
  const domainList = currentDomains
    .split(",")
    .map((domain) => normalizeDomainName(domain))
    .filter((domain) => domain && domain !== normalizedDomainName)

  await env.SITE_CONFIG.put("EMAIL_DOMAINS", domainList.join(","))
}

async function cleanupAutoDomains(env: Env, now: number) {
  if (!CLEANUP_CONFIG.DELETE_AUTO_DOMAINS) {
    console.log("Auto domain cleanup is disabled")
    return
  }

  const candidates = await env.DB
    .prepare(`
      SELECT
        id,
        name,
        status,
        zone_id AS zoneId,
        mx_record_ids AS mxRecordIds,
        txt_record_id AS txtRecordId
      FROM domain
      WHERE cleanup_policy = 'auto'
        AND cleanup_after IS NOT NULL
        AND cleanup_after <= ?
        AND status IN ('active', 'cleanup_failed', 'cleanup_pending')
      ORDER BY cleanup_after ASC
      LIMIT ?
    `)
    .bind(now, CLEANUP_CONFIG.DOMAIN_BATCH_SIZE)
    .all<DomainRow>()

  const domains = candidates.results ?? []
  let cleaned = 0

  for (const domain of domains) {
    let dnsCleaned = false

    try {
      const markResult = await env.DB
        .prepare(`
          UPDATE domain
          SET status = 'cleanup_pending'
          WHERE id = ?
            AND cleanup_policy = 'auto'
            AND status = ?
        `)
        .bind(domain.id, domain.status)
        .run()

      if ((markResult.meta?.changes ?? 0) === 0) {
        continue
      }

      const activeEmails = await getActiveEmailSummary(env, domain.name, now)
      if (activeEmails.count > 0) {
        await setDomainActive(env, domain.id, getCleanupAfterFromExpiry(activeEmails.latestExpiresAt))
        console.log(`Skipped ${domain.name}: ${activeEmails.count} active email(s) remain`)
        continue
      }

      const recordIds = parseRecordIds(domain)
      await deprovisionDomainDns(env, domain, recordIds)
      dnsCleaned = true
      await clearDomainRecordIds(env, domain.id)
      await removeDomainFromKv(env, domain.name)
      const deletedEmails = await deleteExpiredEmailsForDomain(env, domain.name, now)

      await env.DB
        .prepare("DELETE FROM domain WHERE id = ?")
        .bind(domain.id)
        .run()

      cleaned += 1
      console.log(`Cleaned auto domain ${domain.name} with ${deletedEmails} expired email(s)`)
    } catch (error) {
      console.error(`Failed to cleanup auto domain ${domain.name}:`, error)
      if (dnsCleaned) {
        try {
          await clearDomainRecordIds(env, domain.id)
        } catch (clearError) {
          console.error(`Failed to clear DNS record IDs for ${domain.name}:`, clearError)
        }
      }
      await setDomainStatus(env, domain.id, "cleanup_failed")
    }
  }

  console.log(`Cleaned ${cleaned} auto domain(s)`)
}

const main = {
  async scheduled(_: ScheduledEvent, env: Env) {
    const now = Date.now()

    try {
      if (CLEANUP_CONFIG.DELETE_EXPIRED_EMAILS) {
        const result = await env.DB
          .prepare(`
            DELETE FROM email
            WHERE expires_at < ?
            LIMIT ?
          `)
          .bind(now, CLEANUP_CONFIG.BATCH_SIZE)
          .run()

        if (result.success) {
          console.log(`Deleted ${result?.meta?.changes ?? 0} expired emails and their associated messages`)
        } else {
          console.error("Failed to delete expired emails")
        }
      } else {
        console.log("Expired email deletion is disabled")
      }

      await cleanupAutoDomains(env, now)
    } catch (error) {
      console.error("Failed to cleanup:", error)
      throw error
    }
  }
}

export default main
