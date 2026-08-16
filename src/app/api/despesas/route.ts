import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { listLancamentos, createLancamento, checkDuplicataLancamento } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const supabase = getAdmin()
  try {
    const result = await listLancamentos(supabase, {
      tipo: "despesa",
      categoria_id: searchParams.get("categoria_id") || undefined,
      data_inicio: searchParams.get("data_inicio") || undefined,
      data_fim: searchParams.get("data_fim") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "500"),
    })
    return NextResponse.json(result)
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
    if (!body.valor || !body.data) {
      return NextResponse.json({ error: "valor e data sao obrigatorios" }, { status: 400 })
    }
    const finalBody = { ...body, tipo: "despesa" }
    const duplicado = await checkDuplicataLancamento(supabase, body.descricao, parseFloat(body.valor), body.data)
    if (duplicado) return NextResponse.json({ error: "Lançamento duplicado" }, { status: 409 })
    const data = await createLancamento(supabase, finalBody)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}