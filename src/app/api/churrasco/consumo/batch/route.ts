import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { itens } = await request.json()
    if (!itens?.length) return NextResponse.json({ error: "Nenhum item" }, { status: 400 })

    const resultados = []
    const erros = []
    for (const item of itens) {
      const corte_id = item.corte_id
      const quantidade_kg = parseFloat(item.quantidade_kg) || 0
      if (!corte_id || quantidade_kg <= 0) {
        erros.push({ corte_id, erro: "corte_id obrigatorio e quantidade > 0" })
        continue
      }
      const { data, error } = await supabase.rpc("baixar_consumo", {
        p_corte_id: corte_id,
        p_quantidade_kg: quantidade_kg,
        p_data: item.data || new Date().toISOString().slice(0, 10),
        p_observacao: item.observacao || item.descricao || null,
        p_preco_kg: item.valor_total !== undefined && item.valor_total !== null
          ? parseFloat(item.valor_total) / quantidade_kg
          : null,
      })
      if (error) {
        erros.push({ corte_id, erro: error.message })
        continue
      }
      const result = data as { success?: boolean; error?: string; consumo_id?: string }
      if (result?.error) {
        erros.push({ corte_id, erro: result.error })
        continue
      }
      resultados.push({ corte_id, consumo_id: result?.consumo_id })
    }

    return NextResponse.json({ items: resultados, count: resultados.length, erros }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
