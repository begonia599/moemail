const DOMAINS = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EMAIL_DOMAIN ? process.env.NEXT_PUBLIC_EMAIL_DOMAIN : 'moemail.app'

export const EMAIL_CONFIG = {
  MAX_ACTIVE_EMAILS: 30, // Maximum number of active emails
  POLL_INTERVAL: 10_000, // Polling interval in milliseconds
  DOMAINS: DOMAINS.split(','), // Email domains array
} as const

export type EmailConfig = typeof EMAIL_CONFIG 