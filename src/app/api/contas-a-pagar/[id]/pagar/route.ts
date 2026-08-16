import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { pagarConta } from "@/lib/queries"
import { logErro } from "@/lib/log"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const result = await pagarConta(supabase, id, {
      descricao: body.descricao || "Conta",
      valor: parseFloat(body.valor) || 0,
      data: body.data_pagamento || new Date().toISOString().slice(0, 10),
      metodo_pagamento: body.metodo_pagamento,
      multa: parseFloat(body.multa) || 0,
      juros: parseFloat(body.juros) || 0,
    })
    return NextResponse.json({ success: true, conta_a_pagar_id: id, lancamento_id: result.lancamento?.id, status: "pago", valor_pago: result.valor_pago })
  } catch (e: any) {
    logErro('pagar_conta_post', e, { conta_id: id })
    const status = e.message.includes("não encontrada") ? 404 : e.message.includes("já foi paga") ? 409 : 400
    return NextResponse.json({ error: e.message }, { status })
  }
}
