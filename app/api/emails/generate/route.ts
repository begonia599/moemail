import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { auth } from "@/lib/auth"
import { createDb } from "@/lib/db"
import { emails } from "@/lib/schema"
import { eq, and, gt, sql } from "drizzle-orm"
import { EXPIRY_OPTIONS } from "@/types/email"
import { EMAIL_CONFIG } from "@/config"

export const runtime = "edge"

export async function POST(request: Request) {
  const db = createDb()
  const session = await auth()

  try {
    // Check current number of active emails for user
    const activeEmailsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(
        and(
          eq(emails.userId, session!.user!.id!),
          gt(emails.expiresAt, new Date())
        )
      )
    
    if (Number(activeEmailsCount[0].count) >= EMAIL_CONFIG.MAX_ACTIVE_EMAILS) {
      return NextResponse.json(
        { error: `Reached the maximum email limit (${EMAIL_CONFIG.MAX_ACTIVE_EMAILS})` },
        { status: 403 }
      )
    }

    const { name, expiryTime } = await request.json<{ 
      name: string
      expiryTime: number 
    }>()

    // Validate expiry time
    if (!EXPIRY_OPTIONS.some(option => option.value === expiryTime)) {
      return NextResponse.json(
        { error: "Invalid expiry time" },
        { status: 400 }
      )
    }

    const address = `${name || nanoid(8)}@${EMAIL_CONFIG.DOMAIN}`
    const existingEmail = await db.query.emails.findFirst({
      where: eq(emails.address, address)
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      )
    }

    const now = new Date()
    const expires = expiryTime === 0 
      ? new Date('9999-01-01T00:00:00.000Z')
      : new Date(now.getTime() + expiryTime)
    
    const emailData: typeof emails.$inferInsert = {
      address,
      createdAt: now,
      expiresAt: expires,
      userId: session!.user!.id
    }
    
    const result = await db.insert(emails)
      .values(emailData)
      .returning({ id: emails.id, address: emails.address })
    
    return NextResponse.json({ 
      id: result[0].id,
      email: result[0].address 
    })
  } catch (error) {
    console.error('Failed to generate email:', error)
    return NextResponse.json(
      { error: "Failed to generate email" },
      { status: 500 }
    )
  }
} 