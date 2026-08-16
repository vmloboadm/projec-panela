import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateConsumoChurrasco, deleteConsumoChurrasco } from "@/lib/queries"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { id } = await params
    const body = await request.json()

    const { data: atual } = await supabase.from("consumo_churrasco").select("*").eq("id", id).single()
    if (!atual) return NextResponse.json({ error: "Consumo não encontrado" }, { status: 404 })

    const kgAntigo = parseFloat(atual.quantidade_kg) || 0
    const novoKg = body.quantidade_kg !== undefined ? parseFloat(body.quantidade_kg) : kgAntigo
    const corteNovo = body.corte_id || atual.corte_id
    const corteMudou = corteNovo !== atual.corte_id

    const valorTotalNovo = body.valor_total !== undefined && body.valor_total !== null
      ? parseFloat(body.valor_total)
      : kgAntigo > 0
        ? Math.round((((parseFloat(atual.valor_total) || 0) / kgAntigo) * novoKg) * 100) / 100
        : parseFloat(atual.valor_total) || 0

    const getEstoque = async (corteId: string) => {
      const { data: c } = await supabase.from("estoque_carnes").select("quantidade_kg").eq("id", corteId).single()
      return parseFloat(c?.quantidade_kg) || 0
    }

    const ajustaEstoque = async () => {
      if (corteMudou) {
        const estoqueNovoCorte = await getEstoque(corteNovo)
        if (estoqueNovoCorte < novoKg) {
          return NextResponse.json({ error: "Edição ultrapassa o estoque disponível no novo corte" }, { status: 400 })
        }
        await supabase.from("estoque_carnes").update({
          quantidade_kg: Math.round((estoqueNovoCorte - novoKg) * 100) / 100,
        }).eq("id", corteNovo)
        await supabase.from("estoque_carnes").update({
          quantidade_kg: Math.round((await getEstoque(atual.corte_id) + kgAntigo) * 100) / 100,
        }).eq("id", atual.corte_id)
        return null
      }
      const estoqueAtual = await getEstoque(corteNovo)
      const novoEstoque = estoqueAtual + (kgAntigo - novoKg)
      if (novoEstoque < 0) {
        return NextResponse.json({ error: "Edição ultrapassa o estoque disponível" }, { status: 400 })
      }
      await supabase.from("estoque_carnes").update({ quantidade_kg: Math.round(novoEstoque * 100) / 100 }).eq("id", corteNovo)
      return null
    }

    const erroEstoque = await ajustaEstoque()
    if (erroEstoque) return erroEstoque

    const data = await updateConsumoChurrasco(supabase, id, { ...body, valor_total: valorTotalNovo })

    if (atual.lancamento_id) {
      const updateLanc: any = { valor: valorTotalNovo, data: body.data || atual.data }
      if (corteMudou) {
        const { data: carneNova } = await supabase.from("estoque_carnes").select("nome").eq("id", corteNovo).single()
        updateLanc.estoque_ref_id = corteNovo
        updateLanc.descricao = `CONSUMO: ${carneNova?.nome || "Corte"} ${novoKg}kg`
      }
      await supabase.from("lancamentos").update(updateLanc).eq("id", atual.lancamento_id)
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { id } = await params

    const { data: consumo } = await supabase.from("consumo_churrasco").select("*").eq("id", id).single()
    if (consumo?.corte_id) {
      const { data: carne } = await supabase.from("estoque_carnes").select("quantidade_kg").eq("id", consumo.corte_id).single()
      if (carne) {
        const kg = parseFloat(consumo.quantidade_kg) || 0
        await supabase.from("estoque_carnes").update({
          quantidade_kg: Math.round(((parseFloat(carne.quantidade_kg) || 0) + kg) * 100) / 100,
        }).eq("id", consumo.corte_id)
      }
    }

    if (consumo?.lancamento_id) {
      await supabase.from("lancamentos").delete().eq("id", consumo.lancamento_id)
    }

    await deleteConsumoChurrasco(supabase, id)
    return NextResponse.json({ success: true, estoque_revertido: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
