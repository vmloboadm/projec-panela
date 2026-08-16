import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callOmniroute, requireAuth } from '@/lib/api'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  try {
    const { pergunta, contexto } = await request.json()
    if (!pergunta) return NextResponse.json({ error: 'Pergunta obrigatória' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SERVICE_ROLE_KEY!
    )

    const hoje = new Date().toISOString().slice(0, 10)
    const mesAtual = new Date().toISOString().slice(0, 7)

    const [lancamentos, fechamento, contasPendentes, estoque, categorias] = await Promise.all([
      supabase.from('lancamentos').select('tipo, valor, descricao, data, categoria_id').gte('data', hoje).lte('data', hoje),
      supabase.from('fechamento_dia').select('total_vendas, total_despesas, lucro_bruto').eq('data', hoje).single(),
      supabase.from('contas_a_pagar').select('descricao, valor, data_vencimento, status').eq('status', 'pendente').lte('data_vencimento', new Date(Date.now() + 7*86400000).toISOString().slice(0,10)),
      supabase.from('estoque_carnes').select('nome, quantidade_kg, estoque_minimo_kg'),
      supabase.from('categorias').select('id, nome, tipo'),
    ])

    let totalVendasHoje = 0, totalDespesasHoje = 0
    if (lancamentos.data) {
      lancamentos.data.forEach((l: any) => {
        if (l.tipo === 'receita') totalVendasHoje += l.valor || 0
        else totalDespesasHoje += l.valor || 0
      })
    }

    const vendasFeche = fechamento.data?.total_vendas || totalVendasHoje
    const despesasFeche = fechamento.data?.total_despesas || totalDespesasHoje
    const lucroHoje = vendasFeche - despesasFeche

    const estStr = (estoque.data || []).map((e: any) => `${e.nome}: ${e.quantidade_kg}kg (mín: ${e.estoque_minimo_kg}kg)`).join(', ') || 'sem estoque cadastrado'
    const contasStr = (contasPendentes.data || []).map((c: any) => `${c.descricao}: R$ ${c.valor} (vence ${c.data_vencimento})`).join(', ') || 'nenhuma'

    const prompt = `Você é o assistente financeiro do restaurante "Panela da Roça" em Guarus, Campos dos Goytacazes.

DADOS ATUAIS DO SISTEMA (tempo real):
- Vendas hoje: R$ ${vendasFeche.toFixed(2)}
- Despesas hoje: R$ ${despesasFeche.toFixed(2)}
- Lucro hoje: R$ ${lucroHoje.toFixed(2)}
- Contas a pagar pendentes (próximos 7 dias): ${contasStr}
- Estoque de carnes: ${estStr}
- Data: ${new Date().toLocaleDateString('pt-BR')}
- Mês: ${mesAtual}

PERGUNTA DO USUÁRIO: "${pergunta}"

INSTRUÇÕES:
- Responda de forma DIRETA e PRÁTICA, máximo 4 linhas
- Use os dados acima para responder com NÚMEROS REAIS quando possível
- Se a pergunta for sobre vendas, despesas ou lucro, use os valores acima
- Se for sobre estoque, cite os itens e quantidades
- Se for sobre contas, liste as pendentes
- Se não tiver informação suficiente, diga o que falta
- NUNCA invente dados, use apenas os fornecidos
- Responda em português`

    const resposta = await callOmniroute(prompt, 'Você é o assistente financeiro do restaurante "Panela da Roça". Responda APENAS com a resposta em português, direta e prática (máx 4 linhas, no máximo 250 caracteres). Não use markdown, não use JSON, não inclua raciocínio. Use somente os dados fornecidos.', 8000)
    if (!resposta) return NextResponse.json({ resposta: 'Não consegui responder. Tente de outra forma.' })

    return NextResponse.json({ resposta })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
