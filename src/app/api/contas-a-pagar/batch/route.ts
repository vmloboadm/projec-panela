import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { createContasBatch } from "@/lib/queries"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { itens } = await request.json()
    if (!itens?.length) return NextResponse.json({ error: "Nenhum item" }, { status: 400 })
    const inserts = itens.map((item: any) => ({
      descricao: item.descricao || 'Conta',
      valor: parseFloat(item.valor) || 0,
      data_vencimento: item.data_vencimento || item.data || new Date().toISOString().slice(0, 10),
      categoria_id: item.categoria_id || null,
      recorrente: item.recorrente || false,
      status: item.status || 'pendente',
      fornecedor: item.fornecedor || null,
      tipo_documento: item.tipo_documento || 'Outro',
      observacoes: item.observacoes || null,
      ja_lancada: item.ja_lancada === true,
      afeta_caixa: item.afeta_caixa === undefined || item.afeta_caixa === null ? null : item.afeta_caixa === true,
    }))
    const data = await createContasBatch(supabase, inserts)
    return NextResponse.json({ items: data, count: data?.length || 0 }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
