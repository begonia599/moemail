import { Role, ROLES } from "@/lib/permissions"
import { getRequestContext } from "@cloudflare/next-on-pages"

export const runtime = "edge"

export async function GET() {
  const config = await getRequestContext().env.SITE_CONFIG.get("DEFAULT_ROLE")

  return Response.json({ defaultRole: config || ROLES.CIVILIAN })
}

export async function POST(request: Request) {
  const { defaultRole } = await request.json() as { defaultRole: Exclude<Role, typeof ROLES.EMPEROR> }
  
  if (![ROLES.KNIGHT, ROLES.CIVILIAN].includes(defaultRole)) {
    return Response.json({ error: "无效的角色" }, { status: 400 })
  }

  await getRequestContext().env.SITE_CONFIG.put("DEFAULT_ROLE", defaultRole)
  return Response.json({ success: true })
} 