import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicPaths = ["/registro", "/login", "/consentimiento", "/invitacion", "/suscripcion", "/api"]
  const isPublic = publicPaths.some(path => pathname.startsWith(path))
  if (isPublic) return NextResponse.next()

  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/registro", request.url))

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "familia") return response

  const { data: suscripciones } = await supabase
    .from("suscripciones")
    .select("estado, fecha_vencimiento")
    .eq("familia_id", user.id)
    .order("created_at", { ascending: false })

  const tieneAcceso = suscripciones?.some(s =>
    (s.estado === "activa" || s.estado === "trial") &&
    new Date(s.fecha_vencimiento) > new Date()
  )

  if (!tieneAcceso) return NextResponse.redirect(new URL("/suscripcion", request.url))

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}