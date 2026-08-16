import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getCustosMes, upsertCustosMes, TIPOS_CUSTO_MENSAL, LABELS_CUSTO_MENSAL } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7)
  try {
    const valores = await getCustosMes(supabase, mes)
    return NextResponse.json({ mes, valores, labels: LABELS_CUSTO_MENSAL, tipos: TIPOS_CUSTO_MENSAL })
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
    const mes = body.mes || new Date().toISOString().slice(0, 7)
    const valores = body.valores || {}
    const data = await upsertCustosMes(supabase, mes, valores)
    return NextResponse.json({ mes, data, total: data.reduce((a: number, r: any) => a + parseFloat(r.valor || 0), 0) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}