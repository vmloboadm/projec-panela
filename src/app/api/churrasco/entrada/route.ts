import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateCarne } from "@/lib/queries"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const id = body.carne_id || body.corte_id
    const kg = parseFloat(body.quantidade_kg) || 0
    if (!id) return NextResponse.json({ error: "carne_id (ou corte_id) obrigatorio" }, { status: 400 })
    if (kg <= 0) return NextResponse.json({ error: "Quantidade deve ser maior que zero" }, { status: 400 })

    const { data: carne } = await supabase.from("estoque_carnes").select("*").eq("id", id).single()
    if (!carne) return NextResponse.json({ error: "Carne nao encontrada" }, { status: 404 })

    const valorPago = parseFloat(body.valor_pago) || 0
    const preco_kg_compra = valorPago > 0 ? valorPago / kg : (parseFloat(body.preco_kg_compra) || parseFloat(carne.preco_kg_compra) || 0)

    const qtdAtual = parseFloat(carne.quantidade_kg) || 0
    const precoAtual = parseFloat(carne.preco_kg_compra) || 0
    const novoEstoque = Math.round((qtdAtual + kg) * 100) / 100
    const custoTotal = (qtdAtual * precoAtual) + (kg * preco_kg_compra)
    const precoMedio = novoEstoque > 0 ? Math.round((custoTotal / novoEstoque) * 100) / 100 : preco_kg_compra

    const updates: Record<string, any> = {
      quantidade_kg: novoEstoque,
      preco_kg_compra: precoMedio,
    }
    if (body.fornecedor) updates.fornecedor = body.fornecedor

    const data = await updateCarne(supabase, id, updates)
    return NextResponse.json({
      ...data,
      entrada_kg: kg,
      valor_pago: valorPago || Math.round(kg * preco_kg_compra * 100) / 100,
      preco_medio: precoMedio,
    }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
