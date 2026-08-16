import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateLancamento, softDeleteLancamento } from "@/lib/queries"

async function getCategoriaNome(supabase: any, id: string | null) {
  if (!id) return null
  const { data } = await supabase.from("categorias").select("nome").eq("id", id).single()
  return data?.nome || null
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const { data: atual } = await supabase.from("lancamentos").select("*").eq("id", id).single()

    const data = await updateLancamento(supabase, id, body)

    const categoriaAtual = await getCategoriaNome(supabase, body.categoria_id ?? atual?.categoria_id ?? null)
    const categoriaAntiga = await getCategoriaNome(supabase, atual?.categoria_id ?? null)
    const valorNovo = body.valor !== undefined ? parseFloat(body.valor) : parseFloat(atual?.valor)
    const dataNova = body.data || atual?.data

    if (categoriaAtual === "Boletos") {
      const { data: conta } = await supabase.from("contas_a_pagar").select("id").eq("lancamento_id", id).maybeSingle()
      if (conta?.id) {
        await supabase.from("contas_a_pagar").update({
          valor: valorNovo,
          valor_pago: valorNovo,
          data_vencimento: dataNova,
          data_pagamento: dataNova,
          dia_vencimento: parseInt(String(dataNova).slice(8, 10)) || 10,
        }).eq("id", conta.id)
      } else if (categoriaAntiga !== "Boletos") {
        await supabase.from("contas_a_pagar").insert([{
          categoria_id: body.categoria_id ?? atual?.categoria_id,
          descricao: `PAGO: ${body.descricao || atual?.descricao || 'Boleto'}`,
          valor: valorNovo,
          valor_fixo: false,
          recorrente: false,
          dia_vencimento: parseInt(String(dataNova).slice(8, 10)) || 10,
          data_vencimento: dataNova,
          status: 'pago',
          data_pagamento: dataNova,
          lancamento_id: id,
          tipo_documento: 'Boleto',
          metodo_pagamento: body.metodo_pagamento || null,
          valor_pago: valorNovo,
        }])
      }
    } else if (categoriaAntiga === "Boletos") {
      await supabase.from("contas_a_pagar").delete().eq("lancamento_id", id)
    }

    return NextResponse.json(data)
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
    const { data: lancamento } = await supabase.from("lancamentos").select("categoria_id").eq("id", id).single()
    const categoriaNome = await getCategoriaNome(supabase, lancamento?.categoria_id ?? null)
    if (categoriaNome === "Boletos") {
      await supabase.from("contas_a_pagar").delete().eq("lancamento_id", id)
    }
    await softDeleteLancamento(supabase, id)
    return NextResponse.json({ message: "Lancamento excluido" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
