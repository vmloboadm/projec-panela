import { NextResponse } from "next/server"
import { getAdmin, requireAuth, callOmniroute } from "@/lib/api"
import { getAlertasChurrasco, getResumoConsumo } from "@/lib/queries"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { pergunta } = await request.json()

    const [alertas, resumo7, resumo30] = await Promise.all([
      getAlertasChurrasco(supabase),
      getResumoConsumo(supabase, { dias: 7 }),
      getResumoConsumo(supabase, { dias: 30 }),
    ])

    const estBaixo = alertas.estoque_baixo.map((e: any) => `${e.nome} (${e.quantidade_kg}kg / mín ${e.estoque_minimo_kg}kg)`).join(', ') || 'nenhuma'
    const paradas = alertas.carne_parada.map((e: any) => e.nome).join(', ') || 'nenhuma'
    const sug = alertas.sugestao_compra.slice(0, 8).map((s: any) => `${s.nome}: ${s.comprar}kg (~R$ ${s.custo})`).join('; ') || 'nenhuma'
    const ranking = resumo30.por_carne.slice(0, 6).map((r: any) => `${r.nome} (${r.kg}kg)`).join(', ') || 'sem consumo'

    const prompt = pergunta
      ? `PERGUNTA DO USUÁRIO: "${pergunta}"\n`
      : 'Pedido de resumo do estoque de churrasco.\n'

    const body = `${prompt}
DADOS REAIS DO SISTEMA:
- Estoque baixo: ${estBaixo}
- Carnes paradas há 3+ dias: ${paradas}
- Maior consumo da semana: ${alertas.maior_consumo ? `${alertas.maior_consumo.nome} (${alertas.maior_consumo.kg}kg)` : 'nenhum'}
- Consumo 7 dias: ${resumo7.total_kg}kg, custo R$ ${resumo7.total_custo}
- Consumo 30 dias: ${resumo30.total_kg}kg, custo R$ ${resumo30.total_custo}
- Ranking mês: ${ranking}
- Sugestão de compra: ${sug} (total ~R$ ${alertas.total_sugestao})

INSTRUÇÕES: responda em português, curto e prático (máx 8 linhas). Explique como está o estoque, quais carnes precisam de reposição, o consumo recente e sugira o que comprar. NUNCA invente números, use só os fornecidos.`

    const resposta = await callOmniroute(body, 'Você é o assistente de gestão de estoque do restaurante "Panela da Roça". Responda APENAS com o texto do resumo em português, curto e prático (máx 6 linhas, no máximo 300 caracteres). Não use markdown, não use JSON, não inclua raciocínio. Use somente os dados fornecidos.', 8000)
    return NextResponse.json({ resposta: resposta || 'Não consegui gerar o resumo.', alertas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
