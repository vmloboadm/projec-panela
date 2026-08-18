import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const dataParam = searchParams.get("data") || new Date().toISOString().slice(0, 10)
  const supabase = getAdmin()

  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("valor, tipo, afeta_caixa, descricao, categoria_id")
    .eq("data", dataParam)
    .is("deleted_at", null)

  const arr = lancamentos || []
  let saidas_caixa = 0
  let total_despesas = 0
  let total_receitas = 0
  const lista: any[] = []

  for (const l of arr) {
    const v = parseFloat(l.valor || 0)
    if (l.tipo === "despesa") {
      total_despesas += v
      if (l.afeta_caixa !== false) { saidas_caixa += v; lista.push(l) }
    } else if (l.tipo === "receita") {
      total_receitas += v
    }
  }

  const { data: fechamento } = await supabase
    .from("fechamento_dia")
    .select("*")
    .eq("data", dataParam)
    .maybeSingle()

  return NextResponse.json({
    data: dataParam,
    saidas_caixa,
    total_despesas,
    total_receitas,
    despesas_caixa_lista: lista,
    ja_fechado: !!fechamento,
    fechamento: fechamento ? {
      vendas_dinheiro: fechamento.vendas_dinheiro,
      vendas_cartao_credito: fechamento.vendas_cartao_credito,
      vendas_cartao_debito: fechamento.vendas_cartao_debito,
      vendas_pix: fechamento.vendas_pix,
      vendas_vale_refeicao: fechamento.vendas_vale_refeicao,
      vendas_delivery: fechamento.vendas_delivery,
      total_vendas: fechamento.total_vendas,
      total_despesas: fechamento.total_despesas,
      fundo_caixa: fechamento.fundo_caixa,
      caixa_contado: fechamento.caixa_contado,
      esperado_caixa: fechamento.esperado_caixa ?? (fechamento.fundo_caixa + fechamento.vendas_dinheiro - (saidas_caixa)),
      diferenca_caixa: fechamento.diferenca_caixa,
      lucro_bruto: fechamento.lucro_bruto,
    } : null,
  })
}