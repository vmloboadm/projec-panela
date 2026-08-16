import { NextResponse } from "next/server"
import { getAdmin, callOmniroute, requireAuth } from "@/lib/api"
import { resolveCategoriaNome, listCarnes } from "@/lib/queries"

const NORM = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { texto } = await request.json()
  if (!texto) return NextResponse.json({ error: "Texto obrigatorio" }, { status: 400 })

  const admin = getAdmin()

  try {
    const { data: categorias } = await admin.from('categorias').select('id, nome, tipo')
    const listaCats = categorias ? categorias.map((c: any) => c.nome).join(', ') : ''
    const carnes = await listCarnes(admin, true)
    const listaCarnes = carnes.map((c: any) => c.nome).join(', ') || ''

    const sysPrompt =     "Voce extrai dados financeiros e de compras de textos de supermercado/nota. Retorne APENAS array JSON, nada mais. Para CADA item retorne: {tipo_registro, tipo, valor, descricao, categoria, forma_pagamento, quantidade_kg, preco_kg, corte_id, data, data_vencimento}. REGRAS: (1) tipo_registro: lancamento (financeiro normal), OU insumo_churrasco (SE o item for carnecorte, um dos: " + listaCarnes + "), OU conta_a_pagar (boleto/fatura/pagamento com prazo). (2) tipo: receita ou despesa. (3) valor: numero (25 reais=25, 123,00=123, sem numero=0); para carne use o valor total pago, se houver; senao 0. (4) descricao: descritivo, para carne inclua o EXATO nome do corte (ex 'Picanha'). (5) categoria: uma das categorias disponiveis: " + listaCats + ". IMPORTANTE categoria: se o item for um boleto/duplicata/fatura/documento com vencimento, use 'Boletos'. (6) preco_kg: preco por kg se der p/ inferir (ideal = valor/quantidade). (7) forma_pagamento: dinheiro,pix,cartao,credito,debito ou null. (8) data: YYYY-MM-DD (padrao data atual). (9) data_vencimento: so em conta_a_pagar."

    const prompt = "Texto/nota: \"" + texto + "\"\nData atual: " + new Date().toISOString().slice(0, 10) + "\nRetorne APENAS o array JSON com TODOS os itens da compra, separando cada um."

    const aiResponse = await callOmniroute(prompt, sysPrompt, 8000)

    let cleaned = aiResponse.trim()
    cleaned = cleaned.replace(/ thinking[\s\S]*?<\/think>/gi, '').replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')

    let itens: any[] = []
    try { itens = JSON.parse(cleaned) } catch {
      try { itens = [JSON.parse(cleaned)] } catch {
        return NextResponse.json({ erro: 'IA nao conseguiu processar', resposta_bruta: aiResponse.slice(0, 300) })
      }
    }
    if (!Array.isArray(itens)) itens = [itens]

    const carnesPorNome: Record<string, any> = {}
    for (const c of carnes) carnesPorNome[NORM(c.nome)] = c

    const resultados = itens.map((item: any) => {
      let valor = item.valor
      if (typeof valor === 'string') valor = parseFloat(valor.replace(',', '.')) || 0
      if (valor === null || valor === undefined || isNaN(valor)) valor = 0

      const catNome = item.categoria || item.categoria_nome || ''
      const descriItem = item.descricao || ''
      const descNorm = NORM(descriItem)

      let tipoRegistro = item.tipo_registro || 'lancamento'
      let corte_id: string | null = item.corte_id || null
      let precoKg = parseFloat(item.preco_kg || item.valor_preco_kg) || 0

      for (const [nomeNorm, carne] of Object.entries(carnesPorNome)) {
        if (descNorm && (descNorm.includes(nomeNorm) || nomeNorm.includes(descNorm))) {
          tipoRegistro = 'insumo_churrasco'
          corte_id = corte_id || carne.id
          if (!precoKg && carne.preco_kg_compra) precoKg = parseFloat(carne.preco_kg_compra) || 0
          break
        }
      }

      return {
        tipo_registro: tipoRegistro,
        tipo: item.tipo || 'despesa',
        valor: valor,
        descricao: descriItem || texto,
        categoria: catNome || null,
        categoria_id: null as string | null,
        forma_pagamento: item.forma_pagamento || null,
        data: item.data || new Date().toISOString().slice(0, 10),
        observacao: item.observacao || '',
        data_vencimento: item.data_vencimento || item.vencimento || null,
        corte_id: corte_id,
        quantidade_kg: item.quantidade_kg || 0,
        preco_kg: precoKg,
      }
    })

    for (const r of resultados) {
      if (r.categoria) {
        const resolved = await resolveCategoriaNome(admin, r.categoria, r.tipo === 'receita' ? 'receita' : 'despesa')
        r.categoria_id = resolved
      }
      if (!r.categoria_id && r.tipo === 'despesa') {
        const mercado = await resolveCategoriaNome(admin, 'Mercado', 'despesa')
        r.categoria_id = mercado || null
      }
      if (!r.categoria_id) {
        const { data: cats } = await admin.from('categorias').select('id').eq('tipo', r.tipo === 'receita' ? 'receita' : 'despesa').order('nome').limit(1)
        r.categoria_id = cats?.[0]?.id || null
      }
    }

    return NextResponse.json({ itens: resultados, total: resultados.length, carnes_reconhecidas: carnesPorNome })
  } catch (err: any) {
    return NextResponse.json({ erro: 'Erro: ' + err.message })
  }
}