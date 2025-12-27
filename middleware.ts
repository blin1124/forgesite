import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(req: NextRequest) {
  // Create an initial response
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update request cookies (so Supabase sees them in this run)
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          // Update response cookies (so browser receives them)
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: refresh session (if needed)
  await supabase.auth.getUser()

  return res
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes except:
     * - _next static files
     * - images
     * - favicon
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}



