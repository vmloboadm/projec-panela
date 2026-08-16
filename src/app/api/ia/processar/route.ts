import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"

function extrairValor(texto: string): number | null {
  // Procura por padrões de valor: R$ 100, 100 reais, 100,00, etc
  const patterns = [
    /R\$\s*(\d+(?:[.,]\d{2})?)/i,
    /(\d+(?:[.,]\d{2})?)\s*reais/i,
    /(\d+(?:[.,]\d{2})?)/
  ]
  
  for (const pattern of patterns) {
    const match = texto.match(pattern)
    if (match) {
      const valor = match[1].replace(',', '.')
      return parseFloat(valor)
    }
  }
  return null
}

function detectarTipo(texto: string): 'receita' | 'despesa' {
  const textoLower = texto.toLowerCase()
  
  // Palavras-chave de receita
  const receitaKeys = ['vend', 'receb', 'pag', 'entr', 'ganho', 'lucro', 'cliente', 'almoco', 'jantar', 'evento']
  
  // Palavras-chave de despesa
  const despesaKeys = ['compr', 'pag', 'gast', 'despesa', 'conta', 'luz', 'agua', 'gas', 'aluguel', 'salario', 'carne', 'verdura']
  
  let receitaScore = 0
  let despesaScore = 0
  
  for (const key of receitaKeys) {
    if (textoLower.includes(key)) receitaScore++
  }
  
  for (const key of despesaKeys) {
    if (textoLower.includes(key)) despesaScore++
  }
  
  return despesaScore > receitaScore ? 'despesa' : 'receita'
}

async function detectarCategoria(texto: string, tipo: string, admin: any) {
  const textoLower = texto.toLowerCase()
  
  // Buscar categorias do tipo
  const { data: categorias } = await admin
    .from('categorias')
    .select('id, nome')
    .eq('tipo', tipo)
  
  if (!categorias || categorias.length === 0) return null
  
  // Mapear palavras-chave para categorias
  const categoriasMap: Record<string, string[]> = {
    'vendas': ['vend', 'receb', 'cliente', 'almoco', 'jantar', 'prato'],
    'delivery': ['delivery', 'entreg', 'ifood', 'uber'],
    'eventos': ['evento', 'festa', 'aniversario', 'casamento'],
    'aluguel': ['aluguel', 'aluga'],
    'luz': ['luz', 'energia', 'enel', 'cemig'],
    'agua': ['agua', 'saneamento'],
    'gas': ['gas', 'botijao'],
    'internet': ['internet', 'telefone', 'wifi'],
    'salarios': ['salario', 'funcionario', 'folha'],
    'carnes': ['carne', 'boi', 'frango', 'peixe', 'porco'],
    'verduras': ['verdura', 'legume', 'hortifruti', 'feira'],
    'limpeza': ['limpeza', 'detergente', 'sabao'],
    'embalagens': ['embalagem', 'marmita', 'copo', 'tampa']
  }
  
  let melhorCategoria = null
  let melhorScore = 0
  
  for (const cat of categorias) {
    const nomeNorm = cat.nome.toLowerCase()
    let score = 0
    
    // Verificar match direto com o nome da categoria
    if (textoLower.includes(nomeNorm)) {
      score += 10
    }
    
    // Verificar palavras-chave
    for (const [catKey, keywords] of Object.entries(categoriasMap)) {
      if (nomeNorm.includes(catKey) || catKey.includes(nomeNorm)) {
        for (const keyword of keywords) {
          if (textoLower.includes(keyword)) {
            score += 5
          }
        }
      }
    }
    
    if (score > melhorScore) {
      melhorScore = score
      melhorCategoria = cat.id
    }
  }
  
  // Se não encontrou match, retorna a primeira categoria do tipo
  return melhorCategoria || categorias[0].id
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { pendencia_id } = await request.json()
  if (!pendencia_id) {
    return NextResponse.json({ error: "pendencia_id obrigatorio" }, { status: 400 })
  }
  
  const admin = getAdmin()
  
  // Buscar pendência
  const { data: pendencia, error: errPend } = await admin
    .from('ia_pendencias')
    .select('*')
    .eq('id', pendencia_id)
    .single()
  
  if (errPend || !pendencia) {
    return NextResponse.json({ error: "Pendencia nao encontrada" }, { status: 404 })
  }
  
  // Processar baseado na origem
  let sugestao: any = {}
  
  if (pendencia.origem === 'prompt') {
    const texto = pendencia.payload_bruto?.texto || ''
    const valor = extrairValor(texto)
    const tipo = detectarTipo(texto)
    const categoria_id = await detectarCategoria(texto, tipo, admin)
    
    // Gerar descrição baseada no texto
    let descricao = texto.slice(0, 100)
    if (descricao.length < texto.length) descricao += '...'
    
    sugestao = {
      tipo,
      valor: valor || 0,
      categoria_id,
      descricao,
      data: new Date().toISOString().slice(0, 10)
    }
  } else if (pendencia.origem === 'foto') {
    // Para foto, assumir que é uma nota fiscal (despesa)
    sugestao = {
      tipo: 'despesa',
      valor: 0,
      categoria_id: await detectarCategoria('compra', 'despesa', admin),
      descricao: 'Nota fiscal - verificar valor',
      data: new Date().toISOString().slice(0, 10)
    }
  } else if (pendencia.origem === 'audio') {
    // Para áudio, similar ao texto
    sugestao = {
      tipo: 'despesa',
      valor: 0,
      categoria_id: await detectarCategoria('', 'despesa', admin),
      descricao: 'Transcricao de audio - verificar',
      data: new Date().toISOString().slice(0, 10)
    }
  } else if (pendencia.origem === 'boleto') {
    // Para boleto, sempre despesa
    sugestao = {
      tipo: 'despesa',
      valor: 0,
      categoria_id: await detectarCategoria('conta', 'despesa', admin),
      descricao: 'Boleto - verificar valor e vencimento',
      data: new Date().toISOString().slice(0, 10)
    }
  }
  
  // Atualizar pendência com sugestão
  const { error: errUpdate } = await admin
    .from('ia_pendencias')
    .update({ sugestao, status: 'aguardando' })
    .eq('id', pendencia_id)
  
  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }
  
  return NextResponse.json({ pendencia_id, sugestao, status: 'aguardando' })
}
