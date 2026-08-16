import { NextResponse } from "next/server"
import { getAdmin, callOmniroute, requireAuth } from "@/lib/api"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const admin = getAdmin()
  try {
    const { data: lancamentos } = await admin.from("lancamentos").select("tipo, valor, descricao, data").is("deleted_at", null)
    const { data: contasAPagar } = await admin.from("contas_a_pagar").select("descricao, valor, data_vencimento").eq("status", "pendente")

    let receitas = 0, despesas = 0
    const descricoesDespesas: string[] = []
    if (lancamentos) {
      lancamentos.forEach(l => {
        const val = parseFloat(l.valor) || 0
        if (l.tipo === 'receita') receitas += val
        else { despesas += val; if (l.descricao) descricoesDespesas.push(l.descricao) }
      })
    }

    const proximoVencimento = contasAPagar && contasAPagar.length > 0
      ? `Próxima conta a vencer: ${contasAPagar[0].descricao} de R$ ${contasAPagar[0].valor} em ${contasAPagar[0].data_vencimento}`
      : "Nenhuma conta pendente."

    const prompt = `Analise os dados financeiros do restaurante "Panela da Roça" deste mês:\n- Total de Receitas (Vendas): R$ ${receitas.toFixed(2)}\n- Total de Despesas: R$ ${despesas.toFixed(2)}\n- Saldo/Lucro Líquido: R$ ${(receitas - despesas).toFixed(2)}\n- Lista de descrições das últimas despesas realizadas: ${descricoesDespesas.slice(-10).join(", ") || "Nenhuma registrada."}\n- ${proximoVencimento}\n\nCom base nestes dados de restaurante self-service de almoço, gere uma (e apenas uma) recomendação financeira curta, extremamente prática, direta e em tom profissional e amigável em português (máximo 3 linhas). Foque em corte de custos, margem de lucro, ou fluxo de caixa do restaurante.`

    const insight = await callOmniroute(prompt, 'Você é um consultor financeiro especializado em restaurantes self-service. Analise os dados fornecidos e gere uma recomendação curta, extremamente prática, de no maximo 3 linhas em portugues. Retorne APENAS o texto da recomendacao, sem JSON. Foque em acoes concretas para melhorar a saude financeira do restaurante.')
    return NextResponse.json({ insight })
  } catch {
    return NextResponse.json({ insight: "Adicione lançamentos e contas para receber dicas financeiras da inteligência artificial." })
  }
}
