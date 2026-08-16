import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/api'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatorios" }, { status: 400 })
  }
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })
  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
