import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getDespesasResumo } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const supabase = getAdmin()
  try {
    const data_inicio = searchParams.get("data_inicio") || new Date().getFullYear() + "-01-01"
    const data_fim = searchParams.get("data_fim") || new Date().toISOString().slice(0, 10)
    const result = await getDespesasResumo(supabase, { data_inicio, data_fim })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}