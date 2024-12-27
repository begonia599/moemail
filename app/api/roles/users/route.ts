import { createDb } from "@/lib/db"
import { userRoles, users } from "@/lib/schema"
import { eq } from "drizzle-orm"

export const runtime = "edge"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return Response.json(
      { error: "邮箱地址不能为空" },
      { status: 400 }
    )
  }

  const db = createDb()
  
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (!user) {
    return Response.json({ user: null })
  }

  const userRole = await db.query.userRoles.findFirst({
    where: eq(userRoles.userId, user.id),
    with: {
      role: true
    }
  })

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: userRole?.role.name
    }
  })
} 