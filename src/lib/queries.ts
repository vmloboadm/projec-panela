import { getAdmin } from "./api"
import type { SupabaseClient } from "@supabase/supabase-js"

const CONFIG_ID = "00000000-0000-0000-0000-000000000001"

type AdminClient = ReturnType<typeof getAdmin>

// ─── Lancamentos ─────────────────────────────────────────────

export interface LancamentoFilters {
  tipo?: string
  categoria_id?: string
  conta_id?: string
  data_inicio?: string
  data_fim?: string
  page?: number
  limit?: number
}

export async function listLancamentos(supabase: AdminClient, filters: LancamentoFilters = {}) {
  let query = supabase
    .from("lancamentos")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("data", { ascending: false })

  if (filters.tipo) query = query.eq("tipo", filters.tipo)
  if (filters.categoria_id) query = query.eq("categoria_id", filters.categoria_id)
  if (filters.conta_id) query = query.eq("conta_id", filters.conta_id)
  if (filters.data_inicio) query = query.gte("data", filters.data_inicio)
  if (filters.data_fim) query = query.lte("data", filters.data_fim)

  const page = filters.page || 1
  const limit = filters.limit || 20
  const offset = (page - 1) * limit

  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) throw error

  const enriched = await enrichLancamentos(supabase, data || [])
  return { data: enriched, total: count || enriched.length, page, limit }
}

export async function createLancamento(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("lancamentos").insert([{
    tipo: body.tipo,
    valor: parseFloat(body.valor),
    categoria_id: body.categoria_id || null,
    conta_id: body.conta_id || null,
    data: body.data,
    descricao: body.descricao || null,
    origem: body.origem || "manual",
    comprovante_url: body.comprovante_url || null,
    afeta_caixa: body.afeta_caixa !== false,
    afeta_resultado: body.afeta_resultado !== false,
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function updateLancamento(supabase: AdminClient, id: string, body: any) {
  const update: Record<string, any> = {}
  if (body.tipo) update.tipo = body.tipo
  if (body.valor) update.valor = parseFloat(body.valor)
  if (body.categoria_id !== undefined) update.categoria_id = body.categoria_id
  if (body.conta_id !== undefined) update.conta_id = body.conta_id
  if (body.data) update.data = body.data
  if (body.descricao !== undefined) update.descricao = body.descricao
  const { data, error } = await supabase.from("lancamentos").update(update).eq("id", id).select()
  if (error) throw error
  return data?.[0]
}

export async function softDeleteLancamento(supabase: AdminClient, id: string) {
  const { error } = await supabase.from("lancamentos").update({ deleted_at: new Date().toISOString() }).eq("id", id)
  if (error) throw error
}

export async function checkDuplicataLancamento(supabase: AdminClient, descricao: string, valor: number, data: string) {
  const janela = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: existentes } = await supabase
    .from("lancamentos")
    .select("id")
    .eq("descricao", descricao)
    .eq("valor", valor)
    .eq("data", data)
    .gte("created_at", janela)
    .is("deleted_at", null)
    .limit(1)
  return existentes && existentes.length > 0
}

export async function createLancamentosBatch(supabase: AdminClient, items: any[]) {
  const { data, error } = await supabase.from("lancamentos").insert(items).select()
  if (error) throw error
  return data
}

export async function getLancamentosEvolucao(supabase: AdminClient, inicio: string, fim: string) {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("valor, tipo, data")
    .gte("data", inicio)
    .lte("data", fim)
    .is("deleted_at", null)
  if (error) throw error
  return data || []
}

export async function getLancamentosEvolucaoMensal(supabase: AdminClient, meses: number = 6) {
  const resultados: { mes: string; receitas: number; despesas: number; lucro: number }[] = []
  const hoje = new Date()
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const mes = d.toISOString().slice(0, 7)
    const inicio = mes + "-01"
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    const { data } = await supabase
      .from("lancamentos")
      .select("valor, tipo")
      .gte("data", inicio)
      .lte("data", fim)
      .is("deleted_at", null)
    const receitas = (data || []).filter(l => l.tipo === "receita").reduce((s, l) => s + parseFloat(l.valor || 0), 0)
    const despesas = (data || []).filter(l => l.tipo === "despesa").reduce((s, l) => s + parseFloat(l.valor || 0), 0)
    resultados.push({
      mes,
      receitas: Math.round(receitas * 100) / 100,
      despesas: Math.round(despesas * 100) / 100,
      lucro: Math.round((receitas - despesas) * 100) / 100,
    })
  }
  return resultados
}

export async function getLancamentosResumoDiario(supabase: AdminClient) {
  const hoje = new Date().toISOString().slice(0, 10)
  const seteDias = new Date(); seteDias.setDate(seteDias.getDate() - 7)
  const data7d = seteDias.toISOString().slice(0, 10)
  const { data } = await supabase
    .from("lancamentos")
    .select("valor, tipo, categoria_id, conta_id, data")
    .gte("data", data7d)
    .lte("data", hoje)
  return data || []
}

export async function getLancamentosResumo(supabase: AdminClient, mes: string) {
  const inicio = mes + "-01"
  const fim = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from("lancamentos")
    .select("valor, tipo, categoria_id, data, afeta_caixa, afeta_resultado")
    .gte("data", inicio)
    .lte("data", fim)
    .is("deleted_at", null)
  if (error) throw error
  return data || []
}

export async function getLancamentosExport(supabase: AdminClient, filters: { data_inicio?: string; data_fim?: string; tipo?: string }) {
  let query = supabase
    .from("lancamentos")
    .select("data, tipo, valor, descricao, categoria_id, conta_id")
    .is("deleted_at", null)
    .order("data", { ascending: true })
  if (filters.data_inicio) query = query.gte("data", filters.data_inicio)
  if (filters.data_fim) query = query.lte("data", filters.data_fim)
  if (filters.tipo) query = query.eq("tipo", filters.tipo)
  const { data, error } = await query
  if (error) throw error
  return enrichLancamentos(supabase, data || [])
}

async function enrichLancamentos(supabase: AdminClient, lancamentos: any[]) {
  const catsCache: Record<string, string> = {}
  const contasCache: Record<string, string> = {}
  return Promise.all(
    lancamentos.map(async (l) => {
      if (l.categoria_id && !catsCache[l.categoria_id]) {
        const { data: cat } = await supabase.from("categorias").select("nome").eq("id", l.categoria_id).single()
        catsCache[l.categoria_id] = (cat as any)?.nome || "Sem categoria"
      }
      if (l.conta_id && !contasCache[l.conta_id]) {
        const { data: con } = await supabase.from("contas").select("nome").eq("id", l.conta_id).single()
        contasCache[l.conta_id] = (con as any)?.nome || ""
      }
      return { ...l, categoria_nome: catsCache[l.categoria_id] || null, conta_nome: contasCache[l.conta_id] || null }
    })
  )
}

export async function resolveCategoriaNome(supabase: AdminClient, nome: string, tipo: string = "despesa"): Promise<string | null> {
  if (!nome) return null
  const alvo = nome.toLowerCase().trim()
  const { data: cats } = await supabase.from("categorias").select("id, nome").eq("tipo", tipo)
  if (!cats) return null

  const normaliza = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  const exato = cats.find((c: any) => normaliza(c.nome) === alvo || normaliza(c.nome) === normaliza(nome))
  if (exato) return exato.id

  const ordenadas = [...cats].sort((a, b) => b.nome.length - a.nome.length)
  for (const c of ordenadas) {
    const dict = normaliza(c.nome)
    if (dict.includes(alvo) || alvo.includes(dict)) return c.id
  }

  const sinonimos: Record<string, string> = {
    carne: "Carnes", frango: "Carnes", picanha: "Carnes", boi: "Carnes", porco: "Carnes",
    bebida: "Bebidas", refrigerante: "Bebidas", cerveja: "Bebidas", suco: "Bebidas", agua: "Bebidas",
    verdura: "Verduras/Legumes", legume: "Verduras/Legumes", hortifruti: "Verduras/Legumes", fruta: "Verduras/Legumes",
    tempero: "Condimentos/Temperos", condimento: "Condimentos/Temperos", insumo: "Condimentos/Temperos", sal: "Condimentos/Temperos", pimenta: "Condimentos/Temperos",
    limpeza: "Limpeza", detergente: "Limpeza", inseticida: "Limpeza", sabao: "Limpeza",
    gas: "Gas", padaria: "Padaria", feira: "Verduras/Legumes",
    carvao: "Carvão", lenha: "Carvão",
    mercado: "Mercado", supermercado: "Mercado", atacadao: "Mercado", pao_de_acucar: "Mercado",
    boleto: "Boletos", boletos: "Boletos", duplicata: "Boletos", fatura: "Boletos", documento: "Boletos",
    descartavel: "Descartaveis", plastico: "Embalagens", embalagem: "Embalagens",
    utensilio: "Utensilios", faca: "Utensilios", panela: "Utensilios",
    higiene: "Higiene", papel: "Higiene", higienico: "Higiene",
    manutencao: "Manutencao Equipamentos",
  }
  for (const [k, v] of Object.entries(sinonimos)) {
    if (alvo.includes(k)) {
      const match = cats.find((c: any) => normaliza(c.nome) === normaliza(v))
      if (match) return match.id
    }
  }
  return null
}

export async function getDespesasResumo(supabase: AdminClient, filtros: { data_inicio: string; data_fim: string }) {
  const { data, error } = await supabase
    .from("lancamentos")
    .select("id, valor, descricao, categoria_id, conta_id, data")
    .eq("tipo", "despesa")
    .gte("data", filtros.data_inicio)
    .lte("data", filtros.data_fim)
    .is("deleted_at", null)
  if (error) throw error
  const list = data || []

  const { data: cats } = await supabase.from("categorias").select("id, nome")
  const catNome: Record<string, string> = {}
  for (const c of (cats || [])) catNome[c.id] = c.nome

  let total = 0
  const porCategoria: Record<string, { nome: string; total: number; lancamentos: number }> = {}
  const porDia: Record<string, number> = {}
  for (const l of list) {
    const v = parseFloat(l.valor || 0)
    total += v
    const dia = (l.data || "").slice(0, 10)
    porDia[dia] = (porDia[dia] || 0) + v
    const nome = catNome[l.categoria_id] || "Sem categoria"
    if (!porCategoria[nome]) porCategoria[nome] = { nome, total: 0, lancamentos: 0 }
    porCategoria[nome].total += v
    porCategoria[nome].lancamentos++
  }

  const categorias = Object.values(porCategoria)
    .map(c => ({ ...c, percentual: total > 0 ? Math.round((c.total / total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  const top = [...list]
    .sort((a, b) => parseFloat(b.valor || 0) - parseFloat(a.valor || 0))
    .slice(0, 10)
    .map(l => ({ id: l.id, descricao: l.descricao || "Sem descrição", valor: parseFloat(l.valor || 0), data: l.data, categoria: catNome[l.categoria_id] || "Sem categoria" }))

  const porDiaArr = Object.entries(porDia).map(([dia, v]) => ({ dia, total: Math.round(v * 100) / 100 })).sort((a, b) => a.dia.localeCompare(b.dia))

  return {
    total: Math.round(total * 100) / 100,
    categorias,
    porDia: porDiaArr,
    topItens: top,
    totalLancamentos: list.length,
    maiorCategoria: categorias[0] || null,
  }
}

// ─── Contas a Pagar ──────────────────────────────────────────

export interface ContaFilters {
  status?: string
  mes?: string
  fornecedor?: string
  tipo_documento?: string
  busca?: string
}

export async function listContasAPagar(supabase: AdminClient, filters: ContaFilters = {}) {
  let query = supabase.from("contas_a_pagar").select("*").order("data_vencimento", { ascending: true })
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.mes) {
    const [ano, mes] = filters.mes.split("-").map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    query = query.gte("data_vencimento", filters.mes + "-01")
    query = query.lte("data_vencimento", `${filters.mes}-${String(ultimoDia).padStart(2, "0")}`)
  }
  if (filters.fornecedor) query = query.eq("fornecedor", filters.fornecedor)
  if (filters.tipo_documento) query = query.eq("tipo_documento", filters.tipo_documento)
  if (filters.busca) query = query.ilike("descricao", `%${filters.busca}%`)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createContaAPagar(supabase: AdminClient, body: any) {
  const hoje = new Date()
  const ano = body.data_vencimento ? parseInt(body.data_vencimento.slice(0, 4)) : hoje.getFullYear()
  const mes = body.data_vencimento ? parseInt(body.data_vencimento.slice(5, 7)) : hoje.getMonth() + 1
  const dia = body.dia_vencimento || parseInt(body.data_vencimento?.slice(8, 10)) || hoje.getDate()
  const dataVenc = body.data_vencimento || `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
  const { data, error } = await supabase.from("contas_a_pagar").insert([{
    categoria_id: body.categoria_id || null,
    descricao: body.descricao,
    valor: body.valor ? parseFloat(body.valor) : null,
    valor_fixo: body.valor_fixo !== false,
    recorrente: body.recorrente === true,
    dia_vencimento: body.dia_vencimento || parseInt(dataVenc.slice(8, 10)),
    data_vencimento: dataVenc,
    fornecedor: body.fornecedor || null,
    tipo_documento: body.tipo_documento || "Outro",
    observacoes: body.observacoes || null,
    ja_lancada: body.ja_lancada === true,
    afeta_caixa: body.afeta_caixa === undefined || body.afeta_caixa === null ? null : body.afeta_caixa === true,
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function updateContaAPagar(supabase: AdminClient, id: string, body: any) {
  const { data, error } = await supabase.from("contas_a_pagar").update(body).eq("id", id).select()
  if (error) throw error
  return data?.[0]
}

export async function deleteContaAPagar(supabase: AdminClient, id: string) {
  const { error } = await supabase.from("contas_a_pagar").delete().eq("id", id)
  if (error) throw error
}

export async function pagarConta(supabase: AdminClient, id: string, params: { descricao: string; valor: number; data: string; metodo_pagamento?: string; multa?: number; juros?: number }) {
  const { data, error } = await supabase.rpc("pagar_conta", {
    p_conta_id: id,
    p_descricao: params.descricao,
    p_valor: params.valor,
    p_data: params.data,
    p_metodo_pagamento: params.metodo_pagamento,
    p_multa: params.multa || 0,
    p_juros: params.juros || 0,
  })
  if (error) throw error

  const result = data as { success?: boolean; error?: string; lancamento_id?: string; valor_pago?: number }
  if (result?.error) throw new Error(result.error)

  const { data: lancamento } = result?.lancamento_id
    ? await supabase.from("lancamentos").select("*").eq("id", result.lancamento_id).single()
    : { data: null }

  return { lancamento, conta_id: id, valor_pago: result?.valor_pago }
}

export async function createContasBatch(supabase: AdminClient, items: any[]) {
  const { data, error } = await supabase.from("contas_a_pagar").insert(items).select()
  if (error) throw error
  return data
}

export async function getContasAVencer(supabase: AdminClient, dias: number = 3) {
  const data = new Date(); data.setDate(data.getDate() + dias)
  const { data: contas, error } = await supabase
    .from("contas_a_pagar")
    .select("id, descricao, valor, data_vencimento, fornecedor, tipo_documento")
    .lte("data_vencimento", data.toISOString().slice(0, 10))
    .eq("status", "pendente")
    .order("data_vencimento", { ascending: true })
  if (error) throw error
  return contas || []
}

export async function gerarProximoMesConta(supabase: AdminClient, id: string) {
  const { data: conta } = await supabase.from("contas_a_pagar").select("*").eq("id", id).single()
  if (!conta) throw new Error("Conta não encontrada")
  const venc = conta.data_vencimento || `${new Date().toISOString().slice(0, 7)}-${String(conta.dia_vencimento || 10).padStart(2, "0")}`
  const [ano, mes, dia] = venc.split("-").map(Number)
  const proxAno = mes === 12 ? ano + 1 : ano
  const proxMes = mes === 12 ? 1 : mes + 1
  const ultimoDia = new Date(proxAno, proxMes, 0).getDate()
  const novoDia = Math.min(dia, ultimoDia)
  const novaData = `${proxAno}-${String(proxMes).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`
  const { data, error } = await supabase.from("contas_a_pagar").insert([{
    categoria_id: conta.categoria_id,
    descricao: conta.descricao,
    valor: conta.valor,
    valor_fixo: conta.valor_fixo !== false,
    recorrente: conta.recorrente !== false,
    dia_vencimento: novoDia,
    data_vencimento: novaData,
    fornecedor: conta.fornecedor,
    tipo_documento: conta.tipo_documento || "Outro",
    observacoes: conta.observacoes,
    status: "pendente",
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function listFornecedores(supabase: AdminClient) {
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("fornecedor")
    .not("fornecedor", "is", null)
    .not("fornecedor", "eq", "")
    .order("fornecedor")
  if (error) throw error
  const nomes = Array.from(new Set((data || []).map((c: any) => c.fornecedor).filter(Boolean))) as string[]
  return nomes.sort((a, b) => a.localeCompare(b, "pt-BR"))
}

export async function getContasResumoMes(supabase: AdminClient, mes: string) {
  const [ano, m] = mes.split("-").map(Number)
  const ultimoDia = new Date(ano, m, 0).getDate()
  const { data: contas, error } = await supabase
    .from("contas_a_pagar")
    .select("*")
    .gte("data_vencimento", mes + "-01")
    .lte("data_vencimento", `${mes}-${String(ultimoDia).padStart(2, "0")}`)
  if (error) throw error
  const lista = contas || []
  const totalMes = lista.filter(c => c.status !== "pago").reduce((s, c) => s + parseFloat(c.valor || 0), 0)
  const pagas = lista.filter(c => c.status === "pago")
  const totalPago = pagas.reduce((s, c) => s + parseFloat(c.valor_pago ?? c.valor) || 0, 0)
  const pendentes = lista.filter(c => c.status !== "pago")
  const hoje = new Date().toISOString().slice(0, 10)
  const vencidas = pendentes.filter(c => c.data_vencimento < hoje)
  const proximos7 = pendentes.filter(c => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return c.data_vencimento >= hoje && c.data_vencimento <= d.toISOString().slice(0, 10)
  })
  const porFornecedor: Record<string, { total: number; pendentes: number }> = {}
  const porTipoDoc: Record<string, number> = {}
  for (const c of pendentes) {
    const f = c.fornecedor || "Sem fornecedor"
    porFornecedor[f] = porFornecedor[f] || { total: 0, pendentes: 0 }
    porFornecedor[f].total += parseFloat(c.valor || 0)
    porFornecedor[f].pendentes += 1
    const t = c.tipo_documento || "Outro"
    porTipoDoc[t] = (porTipoDoc[t] || 0) + parseFloat(c.valor || 0)
  }
  return {
    mes,
    total_mes: Math.round(totalMes * 100) / 100,
    total_pago: Math.round(totalPago * 100) / 100,
    pendentes: pendentes.length,
    pagas: pagas.length,
    vencidas: vencidas.length,
    total_vencidas: Math.round(vencidas.reduce((s, c) => s + parseFloat(c.valor || 0), 0) * 100) / 100,
    proximos_7d: proximos7.length,
    total_proximos_7d: Math.round(proximos7.reduce((s, c) => s + parseFloat(c.valor || 0), 0) * 100) / 100,
    por_fornecedor: porFornecedor,
    por_tipo_documento: porTipoDoc,
  }
}

// ─── Categorias ──────────────────────────────────────────────

export async function listCategorias(supabase: AdminClient, tipo?: string) {
  let query = supabase.from("categorias").select("*").order("nome")
  if (tipo) query = query.eq("tipo", tipo)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createCategoria(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("categorias").insert([{
    nome: body.nome,
    tipo: body.tipo,
    grupo: body.grupo || null,
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function updateCategoria(supabase: AdminClient, id: string, body: any) {
  const { data, error } = await supabase.from("categorias").update(body).eq("id", id).select()
  if (error) throw error
  return data?.[0]
}

export async function deleteCategoria(supabase: AdminClient, id: string) {
  const { error } = await supabase.from("categorias").delete().eq("id", id)
  if (error) throw error
}

export async function getCategoriaNome(supabase: AdminClient, id: string): Promise<string | null> {
  const { data } = await supabase.from("categorias").select("nome").eq("id", id).single()
  return (data as any)?.nome || null
}

export async function listCategoriasParaIA(supabase: AdminClient, tipo?: string) {
  let query = supabase.from("categorias").select("id, nome, tipo")
  if (tipo) query = query.eq("tipo", tipo)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ─── Contas (bancárias) ──────────────────────────────────────

export async function listContas(supabase: AdminClient) {
  const { data, error } = await supabase.from("contas").select("*").order("nome")
  if (error) throw error
  return data || []
}

export async function createConta(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("contas").insert([{
    nome: body.nome,
    tipo: body.tipo,
    saldo_inicial: body.saldo_inicial || 0,
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function updateConta(supabase: AdminClient, id: string, body: any) {
  const { data, error } = await supabase.from("contas").update(body).eq("id", id).select()
  if (error) throw error
  return data?.[0]
}

export async function deleteConta(supabase: AdminClient, id: string) {
  const { error } = await supabase.from("contas").delete().eq("id", id)
  if (error) throw error
}

export async function getContaNome(supabase: AdminClient, id: string): Promise<string | null> {
  const { data } = await supabase.from("contas").select("nome").eq("id", id).single()
  return (data as any)?.nome || null
}

// ─── Configuração ────────────────────────────────────────────

export const CONFIG_DEFAULTS = {
  id: CONFIG_ID,
  nome_restaurante: "Panela da Roça",
  endereco: "",
  aluguel_mensal: 0,
  funcionarios_mensal: 0,
  energia_mensal: 0,
  agua_mensal: 0,
  outros_fixos: 0,
  tolerancia_caixa: 10,
  preco_carne_padrao_kg: 0,
  meta_diaria_vendas: 0,
}

export async function getConfiguracao(supabase: AdminClient) {
  const { data, error } = await supabase.from("configuracao").select("*").eq("id", CONFIG_ID).single()
  if (error || !data) return CONFIG_DEFAULTS
  return {
    id: data.id,
    nome_restaurante: data.nome_restaurante || "Panela da Roça",
    endereco: data.endereco || "",
    aluguel_mensal: parseFloat(data.aluguel_mensal) || 0,
    funcionarios_mensal: parseFloat(data.funcionarios_mensal) || 0,
    energia_mensal: parseFloat(data.energia_mensal) || 0,
    agua_mensal: parseFloat(data.agua_mensal) || 0,
    outros_fixos: parseFloat(data.outros_fixos) || 0,
    tolerancia_caixa: parseFloat(data.tolerancia_caixa) || 10,
    preco_carne_padrao_kg: parseFloat(data.preco_carne_padrao_kg) || 0,
    meta_diaria_vendas: parseFloat(data.meta_diaria_vendas) || 0,
  }
}

export async function upsertConfiguracao(supabase: AdminClient, body: any) {
  const row = {
    id: CONFIG_ID,
    nome_restaurante: body.nome_restaurante || "Panela da Roça",
    endereco: body.endereco || "",
    aluguel_mensal: parseFloat(body.aluguel_mensal) || 0,
    funcionarios_mensal: parseFloat(body.funcionarios_mensal) || 0,
    energia_mensal: parseFloat(body.energia_mensal) || 0,
    agua_mensal: parseFloat(body.agua_mensal) || 0,
    outros_fixos: parseFloat(body.outros_fixos) || 0,
    tolerancia_caixa: parseFloat(body.tolerancia_caixa) || 10,
    preco_carne_padrao_kg: parseFloat(body.preco_carne_padrao_kg) || 0,
    meta_diaria_vendas: parseFloat(body.meta_diaria_vendas) || 0,
  }
  const { data, error } = await supabase.from("configuracao").upsert(row, { onConflict: "id" }).select().single()
  if (error) throw error
  return data
}

// Tipos de custos variáveis por mês
export const TIPOS_CUSTO_MENSAL = ["aluguel", "funcionarios", "energia", "agua", "internet", "impostos", "gas", "funcionarios_extra", "contador", "outros"] as const
export type TipoCustoMes = (typeof TIPOS_CUSTO_MENSAL)[number]

export const LABELS_CUSTO_MENSAL: Record<TipoCustoMes, string> = {
  aluguel: "Aluguel",
  funcionarios: "Funcionários",
  energia: "Energia (luz)",
  agua: "Água",
  internet: "Internet",
  impostos: "Impostos",
  gas: "Gás",
  funcionarios_extra: "Funcionários extras",
  contador: "Contador",
  outros: "Outros custos",
}

export async function getCustosMes(supabase: AdminClient, mes: string): Promise<Record<TipoCustoMes, number>> {
  const { data } = await supabase.from("custos_mensais").select("tipo, valor").eq("mes", mes)
  const out: Record<string, number> = {}
  for (const row of data || []) out[row.tipo] = parseFloat(row.valor) || 0
  return out as Record<TipoCustoMes, number>
}

export async function upsertCustosMes(supabase: AdminClient, mes: string, valores: Record<string, number>) {
  const rows = TIPOS_CUSTO_MENSAL
    .filter((t: TipoCustoMes) => valores[t] !== undefined && parseFloat(String(valores[t])) > 0)
    .map((t: TipoCustoMes) => ({ mes, tipo: t, valor: parseFloat(String(valores[t])) || 0 }))
  const { data, error } = await supabase.from("custos_mensais").upsert(rows, { onConflict: "mes,tipo" }).select()
  if (error) throw error
  return data || []
}

// ─── Fechamento Dia ──────────────────────────────────────────

export async function upsertFechamentoDia(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("fechamento_dia").upsert({
    data: body.data,
    vendas_dinheiro: parseFloat(body.vendas_dinheiro) || 0,
    vendas_cartao_credito: parseFloat(body.vendas_cartao_credito) || 0,
    vendas_cartao_debito: parseFloat(body.vendas_cartao_debito) || 0,
    vendas_pix: parseFloat(body.vendas_pix) || 0,
    total_vendas: parseFloat(body.total_vendas) || 0,
    total_despesas: parseFloat(body.total_despesas) || 0,
    lucro_bruto: parseFloat(body.lucro_bruto) || parseFloat(body.lucro) || 0,
    clientes_atendidos: parseInt(body.clientes_atendidos) || 0,
    kg_self_service: parseFloat(body.kg_self_service) || 0,
    kg_carnes_churrasco: parseFloat(body.kg_carnes_churrasco) || 0,
    observacoes: body.observacoes || null,
    fechado: body.fechado || false,
    fundo_caixa: parseFloat(body.fundo_caixa) || 0,
    caixa_contado: parseFloat(body.caixa_contado) || 0,
    diferenca_caixa: parseFloat(body.diferenca_caixa) || 0,
  }, { onConflict: "data" }).select()
  if (error) throw error
  return data?.[0]
}

export async function getFechamentosDia(supabase: AdminClient, data_inicio: string, data_fim: string) {
  const { data, error } = await supabase
    .from("fechamento_dia")
    .select("*")
    .gte("data", data_inicio)
    .lte("data", data_fim)
    .order("data", { ascending: false })
  if (error) throw error
  return (data || []).map((f: any) => ({ ...f, lucro: parseFloat(f.lucro_bruto) || 0 }))
}

export async function getFechamentoDia(supabase: AdminClient, data: string) {
  const { data: row } = await supabase
    .from("fechamento_dia")
    .select("total_vendas, total_despesas, lucro_bruto, observacoes")
    .eq("data", data)
    .single()
  if (!row) return null
  return { ...row, lucro: parseFloat((row as any).lucro_bruto) || 0 }
}

export async function updateFechamentoDia(supabase: AdminClient, id: string, body: any) {
  const update: Record<string, any> = {}
  const campos: [string, any][] = [
    ["vendas_dinheiro", parseFloat(body.vendas_dinheiro)],
    ["vendas_cartao_credito", parseFloat(body.vendas_cartao_credito)],
    ["vendas_cartao_debito", parseFloat(body.vendas_cartao_debito)],
    ["vendas_pix", parseFloat(body.vendas_pix)],
    ["vendas_vale_refeicao", parseFloat(body.vendas_vale_refeicao)],
    ["vendas_delivery", parseFloat(body.vendas_delivery)],
    ["total_vendas", parseFloat(body.total_vendas)],
    ["total_despesas", parseFloat(body.total_despesas)],
    ["lucro_bruto", parseFloat(body.lucro_bruto)],
    ["clientes_atendidos", parseInt(body.clientes_atendidos)],
    ["kg_self_service", parseFloat(body.kg_self_service)],
    ["kg_carnes_churrasco", parseFloat(body.kg_carnes_churrasco)],
    ["fundo_caixa", parseFloat(body.fundo_caixa)],
    ["caixa_contado", parseFloat(body.caixa_contado)],
    ["diferenca_caixa", parseFloat(body.diferenca_caixa)],
    ["observacoes", body.observacoes],
  ]
  for (const [k, v] of campos) {
    if (body[k] !== undefined && !isNaN(v as number)) update[k] = v
  }
  if (body.observacoes !== undefined) update.observacoes = body.observacoes
  const { data, error } = await supabase.from("fechamento_dia").update(update).eq("id", id).select()
  if (error) throw error
  return data?.[0]
}

export async function deleteFechamentoDia(supabase: AdminClient, id: string) {
  const { data: alvo } = await supabase.from("fechamento_dia").select("data").eq("id", id).single()
  const { error } = await supabase.from("fechamento_dia").delete().eq("id", id)
  if (error) throw error
  if (alvo?.data) {
    await supabase.from("lancamentos").delete().eq("origem", "fechamento").eq("data", alvo.data)
  }
  return { data: (alvo as any)?.data }
}

// ─── IA Pendências ───────────────────────────────────────────

export async function createPendencia(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("ia_pendencias").insert([{
    origem: body.origem,
    payload_bruto: body.payload_bruto || null,
    sugestao: body.sugestao || {},
    status: "aguardando",
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function getPendencia(supabase: AdminClient, id: string) {
  const { data, error } = await supabase.from("ia_pendencias").select("*").eq("id", id).single()
  if (error) throw error
  return data
}

export async function updatePendencia(supabase: AdminClient, id: string, updates: any) {
  const { error } = await supabase.from("ia_pendencias").update(updates).eq("id", id)
  if (error) throw error
}

export async function confirmarPendenciaLancamento(supabase: AdminClient, id: string, lancamentoId: string) {
  await updatePendencia(supabase, id, { status: "confirmado", lancamento_id: lancamentoId })
}

export async function rejeitarPendencia(supabase: AdminClient, id: string) {
  await updatePendencia(supabase, id, { status: "rejeitado" })
}

// ─── Estoque Carnes (Churrasco) ──────────────────────────────

export async function listCarnes(supabase: AdminClient, includeInativas = false) {
  let query = supabase.from("estoque_carnes").select("*").order("nome")
  if (!includeInativas) query = query.eq("ativo", true)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createCarne(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("estoque_carnes").insert([{
    nome: body.nome,
    tipo_corte: body.tipo_corte?.trim() ? body.tipo_corte.trim() : (body.nome || 'Outro'),
    quantidade_kg: parseFloat(body.quantidade_kg) || 0,
    estoque_minimo_kg: body.estoque_minimo_kg !== undefined ? parseFloat(body.estoque_minimo_kg) : 5,
    ativo: body.ativo !== false,
    preco_kg_compra: parseFloat(body.preco_kg_compra) || 0,
    preco_kg_venda: parseFloat(body.preco_kg_venda) || 0,
    fornecedor: body.fornecedor || null,
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function updateCarne(supabase: AdminClient, id: string, updates: any) {
  const { data, error } = await supabase.from("estoque_carnes").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function getPrecoCarne(supabase: AdminClient, id: string) {
  const { data } = await supabase.from("estoque_carnes").select("preco_kg_compra").eq("id", id).single()
  return (data as any)?.preco_kg_compra || 0
}

// ─── Consumo Churrasco ───────────────────────────────────────

export async function listConsumoChurrasco(supabase: AdminClient, filters: { dias?: number; corte_id?: string; data_inicio?: string; data_fim?: string } = {}) {
  let query = supabase
    .from("consumo_churrasco")
    .select("*, estoque_carnes!inner(nome, tipo_corte, preco_kg_compra)")
    .order("data", { ascending: false })

  if (filters.dias) {
    const inicio = new Date(); inicio.setDate(inicio.getDate() - (filters.dias - 1))
    query = query.gte("data", inicio.toISOString().slice(0, 10))
  }
  if (filters.data_inicio) query = query.gte("data", filters.data_inicio)
  if (filters.data_fim) query = query.lte("data", filters.data_fim)
  if (filters.corte_id) query = query.eq("corte_id", filters.corte_id)

  const { data, error } = await query.limit(200)
  if (error) throw error
  return data || []
}

export async function createConsumoChurrasco(supabase: AdminClient, body: any) {
  const { data, error } = await supabase.from("consumo_churrasco").insert([{
    data: body.data,
    corte_id: body.corte_id,
    quantidade_kg: parseFloat(body.quantidade_kg) || 0,
    valor_total: body.valor_total ? parseFloat(body.valor_total) : 0,
    observacao: body.observacao || null,
  }]).select()
  if (error) throw error
  return data?.[0]
}

export async function createConsumoBatch(supabase: AdminClient, items: any[]) {
  const { data, error } = await supabase.from("consumo_churrasco").insert(items).select()
  if (error) throw error
  return data
}

export async function updateConsumoChurrasco(supabase: AdminClient, id: string, body: any) {
  const updates: any = {}
  if (body.data !== undefined) updates.data = body.data
  if (body.corte_id !== undefined) updates.corte_id = body.corte_id
  if (body.quantidade_kg !== undefined) updates.quantidade_kg = parseFloat(body.quantidade_kg)
  if (body.valor_total !== undefined) updates.valor_total = parseFloat(body.valor_total)
  if (body.observacao !== undefined) updates.observacao = body.observacao || null
  const { data, error } = await supabase.from("consumo_churrasco").update(updates).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteConsumoChurrasco(supabase: AdminClient, id: string) {
  const { error } = await supabase.from("consumo_churrasco").delete().eq("id", id)
  if (error) throw error
}

export async function getResumoConsumo(supabase: AdminClient, filters: { dias?: number; data_inicio?: string; data_fim?: string; corte_id?: string } = {}) {
  const data = await listConsumoChurrasco(supabase, filters)
  let totalKg = 0, totalCusto = 0
  const porCarne: Record<string, { nome: string; kg: number; custo: number }> = {}
  for (const c of data) {
    const kg = parseFloat(c.quantidade_kg) || 0
    const custo = parseFloat(c.valor_total) || kg * (parseFloat((c.estoque_carnes as any)?.preco_kg_compra) || 0)
    totalKg += kg
    totalCusto += custo
    const nome = (c.estoque_carnes as any)?.nome || 'Removido'
    if (!porCarne[nome]) porCarne[nome] = { nome, kg: 0, custo: 0 }
    porCarne[nome].kg += kg
    porCarne[nome].custo += custo
  }
  return {
    total_kg: Math.round(totalKg * 100) / 100,
    total_custo: Math.round(totalCusto * 100) / 100,
    por_carne: Object.values(porCarne).sort((a, b) => b.kg - a.kg),
  }
}

// ─── Alertas Inteligentes Churrasco ──────────────────────────

export async function getAlertasChurrasco(supabase: AdminClient) {
  const carnes = await listCarnes(supabase, true)
  const consumo = await listConsumoChurrasco(supabase, { dias: 7 })
  const hoje = new Date(); hoje.setHours(hoje.getHours() - 3)
  const hojeStr = hoje.toISOString().slice(0, 10)

  const consumoPorCarne: Record<string, number> = {}
  const ultimoUso: Record<string, string> = {}
  for (const c of consumo) {
    if (!c.corte_id) continue
    consumoPorCarne[c.corte_id] = (consumoPorCarne[c.corte_id] || 0) + parseFloat(c.quantidade_kg)
    const d = String(c.data || '').slice(0, 10)
    if (!ultimoUso[c.corte_id] || d > ultimoUso[c.corte_id]) ultimoUso[c.corte_id] = d
  }

  const estoqueBaixo = carnes.filter(c => c.ativo !== false && parseFloat(c.quantidade_kg) < (parseFloat(c.estoque_minimo_kg) || 5))

  const tresDias = new Date(); tresDias.setHours(tresDias.getHours() - 3); tresDias.setDate(tresDias.getDate() - 3)
  const tresDiasStr = tresDias.toISOString().slice(0, 10)
  const carneParada = carnes.filter(c => c.ativo !== false && parseFloat(c.quantidade_kg) > 0 && !(ultimoUso[c.id] && ultimoUso[c.id] >= tresDiasStr))

  let maiorConsumo = null
  for (const c of carnes) {
    const kg = consumoPorCarne[c.id] || 0
    if (kg > 0 && (!maiorConsumo || kg > maiorConsumo.kg)) maiorConsumo = { id: c.id, nome: c.nome, kg: Math.round(kg * 100) / 100 }
  }

  const sugestao = carnes
    .filter(c => c.ativo !== false)
    .map(c => {
      const kg7d = consumoPorCarne[c.id] || 0
      const consumoDiario = kg7d / 7
      const alvo = Math.max(parseFloat(c.estoque_minimo_kg) || 5, consumoDiario * 7)
      const comprar = Math.max(0, alvo - parseFloat(c.quantidade_kg))
      const custo = Math.round(comprar * (parseFloat(c.preco_kg_compra) || 0) * 100) / 100
      return { id: c.id, nome: c.nome, quantidade_kg: parseFloat(c.quantidade_kg), estoque_minimo_kg: parseFloat(c.estoque_minimo_kg) || 5, consumo_semana: Math.round(kg7d * 100) / 100, comprar: Math.round(comprar * 10) / 10, custo }
    })
    .filter(s => s.comprar > 0.5)
    .sort((a, b) => b.comprar - a.comprar)

  return {
    hoje: hojeStr,
    estoque_baixo: estoqueBaixo.map(c => ({ id: c.id, nome: c.nome, quantidade_kg: parseFloat(c.quantidade_kg), estoque_minimo_kg: parseFloat(c.estoque_minimo_kg) || 5 })),
    carne_parada: carneParada.map(c => ({ id: c.id, nome: c.nome, ultimo_uso: ultimoUso[c.id] || null })),
    maior_consumo: maiorConsumo,
    sugestao_compra: sugestao,
    total_sugestao: Math.round(sugestao.reduce((s, x) => s + x.custo, 0) * 100) / 100,
  }
}

// ─── Helpers ─────────────────────────────────────────────────

export async function hasLinkedLancamentos(supabase: AdminClient, column: string, id: string) {
  const { data } = await supabase.from("lancamentos").select("id").eq(column, id).limit(1)
  return (data || []).length > 0
}

// ─── Funcionários ────────────────────────────────────────────

export async function listFuncionarios(supabase: AdminClient, mes: string) {
  const { data, error } = await supabase
    .from("funcionarios")
    .select("id, nome, cargo, salario_base, ativo, created_at")
    .order("nome", { ascending: true })
  if (error) throw error

  const funcionarios = data || []
  const { data: pagamentos, error: errPag } = await supabase
    .from("funcionario_pagamentos")
    .select("funcionario_id, data, tipo, valor, descricao")
    .gte("data", mes + "-01")
    .lte("data", mes + "-31")
    .order("data", { ascending: false })
  if (errPag) throw errPag

  const resumo: Record<string, { pago: number; pagamentos: any[] }> = {}
  for (const f of funcionarios) resumo[f.id] = { pago: 0, pagamentos: [] }
  for (const p of pagamentos || []) {
    const r = resumo[p.funcionario_id]
    if (r) {
      r.pago += parseFloat(p.valor) || 0
      r.pagamentos.push(p)
    }
  }
  return {
    funcionarios: funcionarios.map((f: any) => ({
      ...f,
      salario_base: parseFloat(f.salario_base) || 0,
      pago_mes: Math.round((resumo[f.id]?.pago || 0) * 100) / 100,
      falta_pagar: Math.round(((parseFloat(f.salario_base) || 0) - (resumo[f.id]?.pago || 0)) * 100) / 100,
      pagamentos: resumo[f.id]?.pagamentos || [],
    })),
  }
}

export async function createFuncionario(supabase: AdminClient, body: any) {
  const row = {
    nome: body.nome || "",
    cargo: body.cargo || "Funcionário",
    salario_base: parseFloat(body.salario_base) || 0,
    ativo: body.ativo !== false,
  }
  if (!row.nome) throw new Error("Nome do funcionário é obrigatório")
  const { data, error } = await supabase.from("funcionarios").insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateFuncionario(supabase: AdminClient, id: string, body: any) {
  const row: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.nome !== undefined) row.nome = body.nome || ""
  if (body.cargo !== undefined) row.cargo = body.cargo || "Funcionário"
  if (body.salario_base !== undefined) row.salario_base = parseFloat(body.salario_base) || 0
  if (body.ativo !== undefined) row.ativo = body.ativo !== false
  const { data, error } = await supabase.from("funcionarios").update(row).eq("id", id).select().single()
  if (error) throw error
  return data
}

export async function deleteFuncionario(supabase: AdminClient, id: string) {
  const { data, error } = await supabase.from("funcionarios").delete().eq("id", id).select("id")
  if (error) throw error
  return data
}

export async function registrarPagamentoFuncionario(supabase: AdminClient, body: any) {
  const row = {
    funcionario_id: body.funcionario_id,
    data: body.data || new Date().toISOString().slice(0, 10),
    tipo: body.tipo || "salario",
    valor: parseFloat(body.valor) || 0,
    descricao: body.descricao || null,
  }
  if (!row.funcionario_id) throw new Error("Funcionário é obrigatório")
  if (row.valor <= 0) throw new Error("Valor do pagamento deve ser maior que zero")
  const { data, error } = await supabase.from("funcionario_pagamentos").insert(row).select().single()
  if (error) throw error
  return data
}

export async function listPagamentosFuncionario(supabase: AdminClient, funcionarioId: string, mes: string) {
  const { data, error } = await supabase
    .from("funcionario_pagamentos")
    .select("id, data, tipo, valor, descricao, created_at")
    .eq("funcionario_id", funcionarioId)
    .gte("data", mes + "-01")
    .lte("data", mes + "-31")
    .order("data", { ascending: false })
  if (error) throw error
  return data || []
}

// ─── Gestão / Resumo (queries compostas) ─────────────────────

export async function getResumoMensal(supabase: AdminClient, mes: string) {
  const lancamentos = await getLancamentosResumo(supabase, mes)
  const config = await getConfiguracao(supabase)
  return { lancamentos, config }
}

export async function getLancamentos7d(supabase: AdminClient) {
  const seteDias = new Date(); seteDias.setDate(seteDias.getDate() - 7)
  const { data, error } = await supabase
    .from("lancamentos")
    .select("valor, tipo, categoria_id, afeta_resultado")
    .gte("data", seteDias.toISOString().slice(0, 10))
    .is("deleted_at", null)
  if (error) throw error
  return data || []
}
