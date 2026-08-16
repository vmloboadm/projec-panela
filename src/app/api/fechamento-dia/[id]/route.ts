import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateFechamentoDia, deleteFechamentoDia } from "@/lib/queries"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const totalVendas = (parseFloat(body.vendas_dinheiro) || 0) + (parseFloat(body.vendas_cartao_credito) || 0) + (parseFloat(body.vendas_cartao_debito) || 0) + (parseFloat(body.vendas_pix) || 0) + (parseFloat(body.vendas_vale_refeicao) || 0) + (parseFloat(body.vendas_delivery) || 0)
    const vendasDeliveryBruto = parseFloat(body.vendas_delivery_bruto) || 0
    const lucroBruto = Math.round((totalVendas - (parseFloat(body.total_despesas) || 0)) * 100) / 100
    const fundoCaixa = parseFloat(body.fundo_caixa) || 0
    const caixaContado = parseFloat(body.caixa_contado) || 0

    const { data: fechadoAtual } = await supabase.from("fechamento_dia").select("data").eq("id", id).single()
    const dataFechamento = fechadoAtual?.data || new Date().toISOString().slice(0, 10)
    const { data: saidas } = await supabase.from("lancamentos")
      .select("valor")
      .eq("data", dataFechamento)
      .eq("tipo", "despesa")
      .eq("afeta_caixa", true)
      .neq("origem", "fechamento")
      .is("deleted_at", null)
    const saidasCaixa = (saidas || []).reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
    const esperadoCaixa = Math.round((fundoCaixa + (parseFloat(body.vendas_dinheiro) || 0) - saidasCaixa) * 100) / 100

    const payload = { ...body, total_vendas: totalVendas, vendas_delivery_bruto: vendasDeliveryBruto, lucro_bruto: lucroBruto, fundo_caixa: fundoCaixa, caixa_contado: caixaContado, diferenca_caixa: Math.round((caixaContado - esperadoCaixa) * 100) / 100 }
    const data = await updateFechamentoDia(supabase, id, payload)

    const fechado = fechadoAtual

    if (fechado?.data) {
      const { data: catVendas } = await supabase.from("categorias").select("id").ilike("nome", "Vendas%").limit(1)
      const categoria_id = catVendas?.[0]?.id || null
      await supabase.from("lancamentos").delete().eq("origem", "fechamento").eq("data", fechado.data)
      await supabase.from("lancamentos").insert([{
        tipo: "receita", valor: totalVendas, categoria_id, data: fechado.data,
        descricao: "Fechamento do dia", origem: "fechamento", afeta_caixa: true, afeta_resultado: true,
      }])
    }

    return NextResponse.json({ ...data, total_vendas: totalVendas, lucro_bruto: lucroBruto })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const result = await deleteFechamentoDia(supabase, id)
    return NextResponse.json({ message: "Fechamento excluido", data_excluida: result.data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}