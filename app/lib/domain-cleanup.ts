export const DOMAIN_CLEANUP_POLICIES = {
  MANUAL: "manual",
  AUTO: "auto",
} as const

export type DomainCleanupPolicy =
  typeof DOMAIN_CLEANUP_POLICIES[keyof typeof DOMAIN_CLEANUP_POLICIES]

export const AUTO_DOMAIN_CLEANUP_GRACE_MS = 30 * 60 * 1000

export function isDomainCleanupPolicy(value: unknown): value is DomainCleanupPolicy {
  return value === DOMAIN_CLEANUP_POLICIES.MANUAL || value === DOMAIN_CLEANUP_POLICIES.AUTO
}

export function resolveCleanupPolicy(value: unknown): DomainCleanupPolicy {
  return value === DOMAIN_CLEANUP_POLICIES.MANUAL
    ? DOMAIN_CLEANUP_POLICIES.MANUAL
    : DOMAIN_CLEANUP_POLICIES.AUTO
}

export function getCleanupAfter(
  cleanupPolicy: DomainCleanupPolicy,
  expiresAt: Date
): Date | null {
  if (cleanupPolicy !== DOMAIN_CLEANUP_POLICIES.AUTO) {
    return null
  }

  if (expiresAt.getFullYear() === 9999) {
    return null
  }

  return new Date(expiresAt.getTime() + AUTO_DOMAIN_CLEANUP_GRACE_MS)
}
