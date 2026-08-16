import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/api'

export async function POST(request: Request) {
  const { refresh_token } = await request.json()
  if (!refresh_token) {
    return NextResponse.json({ error: "refresh_token obrigatorio" }, { status: 400 })
  }
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.refreshSession({ refresh_token })
  if (error || !data.session) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 })
  }
  return NextResponse.json({
    user: { id: data.user?.id, email: data.user?.email || null },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
