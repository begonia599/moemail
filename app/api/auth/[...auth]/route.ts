import { GET as authGET, POST } from "@/lib/auth"
import { getRequestContext } from "@cloudflare/next-on-pages"

export const runtime = 'edge'

// TEMP DIAGNOSTIC - records the raw callback URL so the `iss` value GitHub
// actually sends can be confirmed. Remove together with the logger in auth.ts.
export async function GET(request: Request) {
  try {
    if (new URL(request.url).pathname.includes("/callback/")) {
      const { env, ctx } = getRequestContext()
      ctx.waitUntil(
        env.DB.prepare("INSERT INTO debug_log (ts, kind, msg) VALUES (?1, ?2, ?3)")
          .bind(Date.now(), "callback-url", request.url.slice(0, 3000))
          .run()
      )
    }
  } catch {
    // diagnostics must never break auth
  }

  return (authGET as unknown as (req: Request) => Promise<Response>)(request)
}

export { POST }
