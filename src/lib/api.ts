import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SERVICE_ROLE_KEY!

const omnirouteApiKey = process.env.OMNIRoute_API_KEY || ''
const omnirouteApiUrl = process.env.OMNIRoute_API_URL || 'http://127.0.0.1:20130/v1'
const omnirouteModel = process.env.OMNIRoute_MODEL || 'combofree'

export function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey)
}

export function getAdmin() {
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function requireAuth(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 })
  }
  return user
}

export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)

  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function callOmniroute(prompt: string, systemPrompt?: string, maxTokens: number = 500, imagens?: { data: string; mimeType: string }[]): Promise<string> {
  if (!omnirouteApiKey) {
    throw new Error('OMNIRoute API key not configured')
  }

  const sysPrompt = systemPrompt || 'Você é um assistente financeiro do "Panela da Roça". Dado o texto, determine se é um lançamento (lancamento) ou conta a pagar (conta_a_pagar). Retorne JSON puro, sem markdown:\n' +
    'tipo_registro: "lancamento" | "conta_a_pagar",\n' +
    'tipo: "receita" | "despesa",\n' +
    'valor: número,\n' +
    'categoria: uma das categorias possíveis (Vendas Balcão, Delivery, Eventos/Festas, Aluguel, Luz, Agua, Internet/Telefone, Salarios, Carnes, Verduras/Legumes, Gas, Limpeza, Embalagens, Manutencao Equipamentos, Carvão, Mercado, Boletos),\n' +
    'IMPORTANTE categoria: se a compra for de mercado/supermercado/atacadão sem itens detalhados (só valor total), use "Mercado". Se for um único item claro (ex: carvão), use a categoria específica (ex: Carvão). Se for um boleto/conta/documento com vencimento, use "Boletos".\n' +
    'descricao: texto,\n' +
    'data: YYYY-MM-DD ou null,\n' +
    'dia_vencimento: número (1-31) se conta_a_pagar,\n' +
    'recorrente: boolean.\n' +
    'Ex1: {"tipo_registro":"lancamento","tipo":"despesa","valor":150,"categoria":"Gas","descricao":"Compra de gás","data":"2026-07-29"}\n' +
    'Ex2: {"tipo_registro":"conta_a_pagar","tipo":"despesa","valor":4500,"categoria":"Aluguel","descricao":"Aluguel loja","dia_vencimento":5,"recorrente":true}'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000)

  try {
    const response = await fetchComRetry(`${omnirouteApiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${omnirouteApiKey}`,
      },
      body: JSON.stringify({
        model: imagens && imagens.length > 0 ? (process.env.OMNIRoute_VISION_MODEL || 'auto/best-vision') : omnirouteModel,
        messages: [
          { role: 'system', content: sysPrompt },
          ...(imagens && imagens.length > 0
            ? [{ role: 'user', content: [
                { type: 'text', text: prompt },
                ...imagens.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType || 'image/png'};base64,${img.data}` } })),
              ] }]
            : [{ role: 'user', content: prompt }]),
        ],
        temperature: 0.1,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Omniroute API error: ${response.status}`)
    }

    const text = await response.text()

    // Try parse as JSON first (non-streaming)
    try {
      const data = JSON.parse(text)
      return limparRespostaIA(data.choices?.[0]?.message?.content || '', 6000)
    } catch {}

    // Fallback: parse SSE streaming format (data: {...} lines)
    let content = ''
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') break
        try {
          const chunk = JSON.parse(payload)
          const delta = chunk.choices?.[0]?.delta
          if (delta?.content) content += delta.content
        } catch {}
      }
    }
    return limparRespostaIA(content, 6000)
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchComRetry(url: string, options: RequestInit & { signal?: AbortSignal }, tentativas = 3): Promise<Response> {
  const baseDelay = 800
  let lastError: Error | null = null

  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(url, options)
      if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
        lastError = new Error(`Omniroute API error: ${res.status}`)
        if (i < tentativas - 1) {
          const delay = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 200)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
      }
      return res
    } catch (e: any) {
      lastError = e
      if (options.signal?.aborted) throw e
      if (i < tentativas - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 200)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
    }
  }

  throw lastError || new Error('Omniroute API request failed')
}

function limparRespostaIA(texto: string, maxChars = 600): string {
  let t = texto || ''
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '')
  if (/<think>/i.test(t)) {
    t = t.replace(/<think>[\s\S]*$/i, '')
  }
  t = t.replace(/^```(?:json|txt|text)?\s*/i, '').replace(/```\s*$/i, '')
  t = t.replace(/^["']|["']$/g, '')
  t = t.trim()
  if (t.length > maxChars) {
    const corte = t.slice(0, maxChars)
    const ultimaLinha = corte.lastIndexOf('\n')
    t = (ultimaLinha > maxChars * 0.6 ? corte.slice(0, ultimaLinha) : corte).trim()
  }
  return t
}

export async function processarSugestaoIA(admin: any, sugestao: any, origem: string = 'prompt') {
  const tipo_registro = sugestao.tipo_registro || 'lancamento'
  const tipo = sugestao.tipo || 'despesa'
  const valor = parseFloat(sugestao.valor) || 0
  const descricao = sugestao.descricao || ''
  const categoria_nome = sugestao.categoria || ''
  
  let categoria_id = sugestao.categoria_id || null
  if (!categoria_id && categoria_nome) {
    const { data: cats } = await admin
      .from('categorias')
      .select('id')
      .eq('tipo', tipo)
      .ilike('nome', `%${categoria_nome}%`)
      .limit(1)
    if (cats && cats.length > 0) {
      categoria_id = cats[0].id
    }
  }
  if (!categoria_id && tipo === 'despesa') {
    const { data: mercado } = await admin
      .from('categorias')
      .select('id')
      .ilike('nome', 'Mercado')
      .eq('tipo', 'despesa')
      .limit(1)
    if (mercado && mercado.length > 0) categoria_id = mercado[0].id
  }
  if (!categoria_id) {
    const { data: allCats } = await admin
      .from('categorias')
      .select('id')
      .eq('tipo', tipo)
      .limit(1)
    if (allCats && allCats.length > 0) categoria_id = allCats[0].id
  }

  if (tipo_registro === 'conta_a_pagar') {
    const dia_vencimento = sugestao.dia_vencimento || 10
    const recorrente = sugestao.recorrente === true
    
    const { data } = await admin.from('contas_a_pagar').insert([{
      categoria_id,
      descricao,
      valor: valor || null,
      valor_fixo: true,
      recorrente,
      dia_vencimento,
      data_vencimento: sugestao.data || sugestao.data_vencimento || new Date().toISOString().slice(0, 10),
      status: 'pendente'
    }]).select()
    
    return {
      action: 'criado_conta_a_pagar',
      id: data?.[0]?.id,
      tipo_registro: 'conta_a_pagar',
      sugestao: { ...sugestao, categoria_id }
    }
  } else {
    const { data } = await admin.from('lancamentos').insert([{
      tipo,
      valor,
      categoria_id,
      data: sugestao.data || new Date().toISOString().slice(0, 10),
      descricao,
      origem: 'ia_' + origem,
    }]).select()
    
    return {
      action: 'criado_lancamento',
      id: data?.[0]?.id,
      tipo_registro: 'lancamento',
      sugestao: { ...sugestao, categoria_id }
    }
  }
}