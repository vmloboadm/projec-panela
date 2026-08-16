import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateCarne } from "@/lib/queries"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { id } = await params
    const body = await request.json()
    const updates: Record<string, any> = {}
    if (body.nome !== undefined) updates.nome = body.nome
    if (body.tipo_corte !== undefined) updates.tipo_corte = body.tipo_corte
    if (body.quantidade_kg !== undefined) updates.quantidade_kg = parseFloat(body.quantidade_kg)
    if (body.preco_kg_compra !== undefined) updates.preco_kg_compra = parseFloat(body.preco_kg_compra)
    if (body.preco_kg_venda !== undefined) updates.preco_kg_venda = parseFloat(body.preco_kg_venda)
    if (body.preco_kg !== undefined) updates.preco_kg = parseFloat(body.preco_kg)
    if (body.estoque_minimo_kg !== undefined) updates.estoque_minimo_kg = parseFloat(body.estoque_minimo_kg)
    if (body.fornecedor !== undefined) updates.fornecedor = body.fornecedor || null
    if (body.ativo !== undefined) updates.ativo = body.ativo === true || body.ativo === 'true'
    const data = await updateCarne(supabase, id, updates)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
