import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getConfiguracao, upsertConfiguracao } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const data = await getConfiguracao(supabase)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const data = await upsertConfiguracao(supabase, body)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
