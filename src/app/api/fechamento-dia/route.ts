import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getFechamentosDia } from "@/lib/queries"
import { logErro } from "@/lib/log"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  let body: any = null
  try {
    body = await request.json()
    const vendasDinheiro = parseFloat(body.vendas_dinheiro) || 0
    const vendasCredito = parseFloat(body.vendas_cartao_credito) || 0
    const vendasDebito = parseFloat(body.vendas_cartao_debito) || 0
    const vendasPix = parseFloat(body.vendas_pix) || 0
    const vendasVale = parseFloat(body.vendas_vale_refeicao) || 0
    const vendasDelivery = parseFloat(body.vendas_delivery) || 0
    const vendasDeliveryBruto = parseFloat(body.vendas_delivery_bruto) || 0
    const totalVendas = Math.round((vendasDinheiro + vendasCredito + vendasDebito + vendasPix + vendasVale + vendasDelivery) * 100) / 100
    const totalDespesas = Math.round((parseFloat(body.total_despesas) || 0) * 100) / 100
    const dataFechamento = body.data || new Date().toISOString().slice(0, 10)
    const lucroCalculado = Math.round((totalVendas - totalDespesas) * 100) / 100
    const lucroBruto = body.lucro !== undefined && body.lucro !== null && body.lucro !== ''
      ? Math.round(parseFloat(body.lucro) * 100) / 100
      : lucroCalculado
    const fundoCaixa = Math.round((parseFloat(body.fundo_caixa) || 0) * 100) / 100
    const caixaContado = Math.round((parseFloat(body.caixa_contado) || 0) * 100) / 100

    const { data, error } = await supabase.rpc("fechar_dia", {
      p_data: dataFechamento,
      p_vendas_dinheiro: vendasDinheiro,
      p_vendas_cartao_credito: vendasCredito,
      p_vendas_cartao_debito: vendasDebito,
      p_vendas_pix: vendasPix,
      p_total_vendas: totalVendas,
      p_total_despesas: totalDespesas,
      p_lucro_bruto: lucroBruto,
      p_clientes_atendidos: parseInt(body.clientes_atendidos) || 0,
      p_kg_self_service: parseFloat(body.kg_self_service) || 0,
      p_kg_carnes_churrasco: parseFloat(body.kg_carnes_churrasco) || 0,
      p_observacoes: body.observacoes || null,
      p_fundo_caixa: fundoCaixa,
      p_caixa_contado: caixaContado,
      p_vendas_vale_refeicao: vendasVale,
      p_vendas_delivery: vendasDelivery,
      p_vendas_delivery_bruto: vendasDeliveryBruto,
    })
    if (error) throw error

    const result = data as { success?: boolean; error?: string; fechamento_id?: string; lancamento_id?: string; total_vendas?: number; lucro_bruto?: number; fundo_caixa?: number; caixa_contado?: number; saidas_caixa?: number; esperado_caixa?: number; diferenca_caixa?: number }
    if (result?.error) throw new Error(result.error)

    return NextResponse.json({
      ...result,
      total_vendas: totalVendas,
      lucro_bruto: lucroBruto,
      fundo_caixa: fundoCaixa,
      caixa_contado: caixaContado,
      pagamentos: { dinheiro: vendasDinheiro, credito: vendasCredito, debito: vendasDebito, pix: vendasPix, vale_refeicao: vendasVale, delivery: vendasDelivery, delivery_bruto: vendasDeliveryBruto },
    }, { status: 201 })
  } catch (e: any) {
    logErro('fechamento_dia_post', e, { data: body?.data })
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const supabase = getAdmin()
  try {
    const data_inicio = searchParams.get("data_inicio") || new Date().toISOString().slice(0, 10)
    const data_fim = searchParams.get("data_fim") || data_inicio
    const data = await getFechamentosDia(supabase, data_inicio, data_fim)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
