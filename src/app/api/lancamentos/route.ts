import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { listLancamentos, createLancamento, checkDuplicataLancamento } from "@/lib/queries"

async function vincularContaAPagar(supabase: any, lancamento: any, body: any) {
  if (lancamento?.tipo !== 'despesa' || !lancamento?.categoria_id) return
  const { data: cat } = await supabase
    .from('categorias')
    .select('id, nome')
    .eq('id', lancamento.categoria_id)
    .single()
  if (cat?.nome !== 'Boletos') return
  const data = lancamento.data || new Date().toISOString().slice(0, 10)
  await supabase.from('contas_a_pagar').insert([{
    categoria_id: lancamento.categoria_id,
    descricao: body.descricao_conta || `PAGO: ${lancamento.descricao || 'Boleto'}`,
    valor: parseFloat(lancamento.valor) || null,
    valor_fixo: false,
    recorrente: false,
    dia_vencimento: parseInt(data.slice(8, 10)) || 10,
    data_vencimento: data,
    status: 'pago',
    data_pagamento: data,
    lancamento_id: lancamento.id,
    tipo_documento: 'Boleto',
    metodo_pagamento: body.metodo_pagamento || null,
    fornecedor: body.fornecedor || null,
    valor_pago: parseFloat(lancamento.valor) || null,
  }])
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const supabase = getAdmin()
  try {
    const result = await listLancamentos(supabase, {
      tipo: searchParams.get("tipo") || undefined,
      categoria_id: searchParams.get("categoria_id") || undefined,
      conta_id: searchParams.get("conta_id") || undefined,
      data_inicio: searchParams.get("data_inicio") || undefined,
      data_fim: searchParams.get("data_fim") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
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
    if (!body.tipo || !body.valor || !body.data) {
      return NextResponse.json({ error: "tipo, valor e data sao obrigatorios" }, { status: 400 })
    }
    const duplicado = await checkDuplicataLancamento(supabase, body.descricao, parseFloat(body.valor), body.data)
    if (duplicado) return NextResponse.json({ error: "Lancamento duplicado" }, { status: 409 })
    const data = await createLancamento(supabase, body)
    await vincularContaAPagar(supabase, data, body)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
