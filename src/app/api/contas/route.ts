import { NextResponse } from 'next/server'
import { getAdmin, requireAuth } from '@/lib/api'
import { listContas, createConta } from '@/lib/queries'

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const contas = await listContas(supabase)
    const result = await Promise.all(
      (contas || []).map(async (conta) => {
        const { data: receitas } = await supabase
          .from("lancamentos")
          .select("valor")
          .eq("conta_id", conta.id)
          .eq("tipo", "receita")
          .is("deleted_at", null)
        const { data: despesas } = await supabase
          .from("lancamentos")
          .select("valor")
          .eq("conta_id", conta.id)
          .eq("tipo", "despesa")
          .is("deleted_at", null)
        const r = (receitas || []).reduce((s, x) => s + parseFloat(x.valor || 0), 0)
        const d = (despesas || []).reduce((s, x) => s + parseFloat(x.valor || 0), 0)
        return {
          id: conta.id,
          nome: conta.nome,
          tipo: conta.tipo,
          saldo_inicial: parseFloat(conta.saldo_inicial || 0),
          saldo_atual: parseFloat(conta.saldo_inicial || 0) + r - d,
        }
      })
    )
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
    const data = await createConta(supabase, body)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
