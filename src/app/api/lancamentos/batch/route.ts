import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { createLancamentosBatch } from "@/lib/queries"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { itens } = await request.json()
    if (!itens?.length) return NextResponse.json({ error: "Nenhum item" }, { status: 400 })
    const inserts = itens.map((item: any) => ({
      tipo: item.tipo || 'despesa',
      valor: parseFloat(item.valor) || 0,
      categoria_id: item.categoria_id || null,
      conta_id: item.conta_id || null,
      data: item.data || new Date().toISOString().slice(0, 10),
      descricao: item.descricao || null,
      origem: item.origem || 'ia',
      comprovante_url: item.comprovante_url || null,
      afeta_caixa: item.afeta_caixa !== false,
      afeta_resultado: item.afeta_resultado !== false,
    }))
    const data = await createLancamentosBatch(supabase, inserts)
    return NextResponse.json({ items: data, count: data?.length || 0 }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
