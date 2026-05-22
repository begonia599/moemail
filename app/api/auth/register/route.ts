import { NextResponse } from "next/server"
import { register } from "@/lib/auth"
import { authSchema, AuthSchema } from "@/lib/validation"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { getRegistrationStatus } from "@/lib/registration"

export const runtime = "edge"

export async function POST(request: Request) {
  try {
    const json = await request.json() as AuthSchema
    
    try {
      authSchema.parse(json)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "输入格式不正确" },
        { status: 400 }
      )
    }

    const { username, password, turnstileToken } = json

    const registration = await getRegistrationStatus()
    if (!registration.enabled) {
      return NextResponse.json(
        {
          error: "注册功能已关闭，请联系管理员",
          code: "REGISTRATION_DISABLED",
        },
        { status: 403 }
      )
    }

    const verification = await verifyTurnstileToken(turnstileToken)
    if (!verification.success) {
      const message = verification.reason === "missing-token"
        ? "请先完成安全验证"
        : "安全验证未通过"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const user = await register(username, password)

    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 }
    )
  }
} 
