import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const VISITANTE_EMAIL_CONST = 'visitante@panela.demo'
const METHODS_ESCRITA = ['POST', 'PUT', 'PATCH', 'DELETE']

function pegarJwt(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

function emailDoToken(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const utf8 = decodeURIComponent(
      atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    const payload = JSON.parse(utf8)
    return payload.email || payload.user_metadata?.email || null
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (!path.startsWith('/api/')) return NextResponse.next()

  if (!METHODS_ESCRITA.includes(request.method)) return NextResponse.next()

  const token = pegarJwt(request)
  if (!token) return NextResponse.next()

  const email = emailDoToken(token)
  const visitanteEmail = process.env.VISITANTE_EMAIL || VISITANTE_EMAIL_CONST

  if (email && email === visitanteEmail) {
    return NextResponse.json(
      { error: 'Modo visitante: apenas visualização. Faca login com sua conta para editar.' },
      { status: 403 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}