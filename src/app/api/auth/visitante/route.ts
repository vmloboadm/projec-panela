import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/api'

export async function POST(request: Request) {
  const { senha } = await request.json().catch(() => ({}))
  const demo = process.env.VISITANTE_DEMO_SENHA || 'visitante123'
  const email = process.env.VISITANTE_EMAIL || 'visitante@panela.demo'
  const secret = process.env.VISITANTE_SECRET

  if (!senha || senha !== demo) {
    return NextResponse.json({ error: 'Senha de visitante invalida' }, { status: 401 })
  }
  if (!secret) {
    return NextResponse.json({ error: 'Visitante nao configurado no servidor' }, { status: 500 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: secret })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email, visitante: true },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    visitante: true,
  })
}