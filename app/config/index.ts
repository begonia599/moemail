export const EMAIL_CONFIG = {
  MAX_ACTIVE_EMAILS: 30, // Maximum number of active emails
  POLL_INTERVAL: 10_000, // Polling interval in milliseconds
  DOMAIN: process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'moemail.app', // Email domain
} as const

export const WEBHOOK_CONFIG = {
  MAX_RETRIES: 3, // Maximum retry count
  TIMEOUT: 10_000, // Timeout time (milliseconds)
  RETRY_DELAY: 1000, // Retry delay (milliseconds)
  EVENTS: {
    NEW_MESSAGE: 'new_message',
  }
} as const