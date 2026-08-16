import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { listConsumoChurrasco } from "@/lib/queries"
import { logErro } from "@/lib/log"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { searchParams } = new URL(request.url)
    const dias = searchParams.get("dias") ? parseInt(searchParams.get("dias")!) : undefined
    const corte_id = searchParams.get("corte_id") || undefined
    const data_inicio = searchParams.get("data_inicio") || undefined
    const data_fim = searchParams.get("data_fim") || undefined
    const data = await listConsumoChurrasco(supabase, {
      dias: dias && !isNaN(dias) ? dias : undefined,
      corte_id,
      data_inicio,
      data_fim,
    })
    const enriched = (data || []).map((c: any) => ({
      ...c,
      corte_nome: (c.estoque_carnes as any)?.nome || 'Corte removido',
      corte_tipo: (c.estoque_carnes as any)?.tipo_corte || '',
    }))
    return NextResponse.json(enriched)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  let body: any = null
  try {
    body = await request.json()
    const corte_id = body.corte_id
    const quantidade_kg = parseFloat(body.quantidade_kg) || 0
    const dataBaixa = body.data || new Date().toISOString().slice(0, 10)

    if (!corte_id) return NextResponse.json({ error: "corte_id obrigatorio" }, { status: 400 })
    if (quantidade_kg <= 0) return NextResponse.json({ error: "Quantidade deve ser maior que zero" }, { status: 400 })

    const { data, error } = await supabase.rpc("baixar_consumo", {
      p_corte_id: corte_id,
      p_quantidade_kg: quantidade_kg,
      p_data: dataBaixa,
      p_observacao: body.observacao || null,
      p_preco_kg: body.valor_total !== undefined && body.valor_total !== null
        ? parseFloat(body.valor_total) / quantidade_kg
        : null,
    })
    if (error) throw error

    const result = data as { success?: boolean; error?: string; consumo_id?: string; lancamento_id?: string; estoque_atualizado?: number; valor_total?: number }
    if (result?.error) throw new Error(result.error)

    return NextResponse.json({
      id: result?.consumo_id,
      valor_total: result?.valor_total,
      estoque_atualizado: result?.estoque_atualizado,
      lancamento_id: result?.lancamento_id,
    }, { status: 201 })
  } catch (e: any) {
    logErro('consumo_churrasco_post', e, { corte_id: body?.corte_id, quantidade_kg: body?.quantidade_kg })
    const msg = e.message || ""
    const status = msg.includes("Estoque insuficiente") ? 400 : (msg.includes("nao encontrada") || msg.includes("não encontrada")) ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
