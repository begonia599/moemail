import { getRequestContext } from "@cloudflare/next-on-pages"
import { eq } from "drizzle-orm"
import { createDb } from "@/lib/db"
import { roles } from "@/lib/schema"
import { ROLES } from "@/lib/permissions"

export const REGISTRATION_ENABLED_KEY = "REGISTRATION_ENABLED"

export interface RegistrationStatus {
  enabled: boolean
  hasEmperor: boolean
}

async function hasEmperorUser(): Promise<boolean> {
  const db = createDb()
  const emperorRole = await db.query.roles.findFirst({
    where: eq(roles.name, ROLES.EMPEROR),
    with: {
      userRoles: true,
    },
  })

  return Boolean(emperorRole?.userRoles.length)
}

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  const env = getRequestContext().env
  const [storedValue, emperorExists] = await Promise.all([
    env.SITE_CONFIG.get(REGISTRATION_ENABLED_KEY),
    hasEmperorUser(),
  ])

  return {
    // The first account must be able to register so an emperor can be initialized.
    enabled: !emperorExists || storedValue !== "false",
    hasEmperor: emperorExists,
  }
}
