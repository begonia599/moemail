import { register } from "@/lib/auth"
import { authSchema } from "@/lib/validation"
import { ZodError } from "zod"

export const runtime = "edge"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const body = authSchema.parse(json)

    await register(body.username, body.password)
    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 }
    )
  }
} 