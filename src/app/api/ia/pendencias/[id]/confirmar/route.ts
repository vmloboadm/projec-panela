import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getPendencia, createLancamento, confirmarPendenciaLancamento } from "@/lib/queries"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  let body: any = {}
  try { body = await request.json() } catch {}

  if (!body.tipo || !['receita', 'despesa'].includes(body.tipo)) {
    return NextResponse.json({ error: "Campo 'tipo' obrigatorio (receita ou despesa)" }, { status: 400 })
  }
  const valor = parseFloat(body.valor)
  if (isNaN(valor) || valor <= 0) {
    return NextResponse.json({ error: "Campo 'valor' obrigatorio e maior que zero" }, { status: 400 })
  }
  if (!body.data) {
    return NextResponse.json({ error: "Campo 'data' obrigatorio" }, { status: 400 })
  }

  try {
    const pendencia = await getPendencia(supabase, id)
    const lancamento = await createLancamento(supabase, {
      tipo: body.tipo,
      valor: valor,
      categoria_id: body.categoria_id || null,
      conta_id: body.conta_id || null,
      data: body.data,
      descricao: body.descricao || null,
      origem: pendencia.origem === "audio" ? "ia_audio" : pendencia.origem === "foto" ? "ia_foto" : pendencia.origem === "boleto" ? "ia_boleto" : "ia_prompt",
    })
    await confirmarPendenciaLancamento(supabase, id, lancamento.id)
    return NextResponse.json({ lancamento_id: lancamento.id, pendencia_id: id, status: "confirmado" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
