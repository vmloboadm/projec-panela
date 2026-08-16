import { NextResponse } from "next/server"
import { getAdmin, callOmniroute, requireAuth } from "@/lib/api"
import { createPendencia, updatePendencia } from "@/lib/queries"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const admin = getAdmin()
  try {
    const formData = await request.formData()
    const arquivo = formData.get("arquivo") as File | null
    if (!arquivo) return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 })

    const pendencia = await createPendencia(admin, { origem: "boleto", payload_bruto: { nome_arquivo: arquivo.name, tamanho: arquivo.size } })
    const pendencia_id = pendencia?.id

    const sysPrompt = "Voce extrai dados de boletos e contas para pagamento. Retorne APENAS JSON, nada mais, sem markdown. Campos obrigatorios: tipo_registro (sempre 'conta_a_pagar'), tipo (sempre 'despesa'), valor (numero, 123,45 = 123.45), descricao (resumo do boleto), fornecedor (quem emite o boleto, ex: empresa/banco), tipo_documento ('Boleto' ou 'NFe' ou 'Duplicata' ou 'Outro'), vencimento (data YYYY-MM-DD), dia_vencimento (inteiro), categoria (pode ser null)."

    let conteudo = ""
    const extensao = arquivo.name.split('.').pop()?.toLowerCase() || ''
    if (['jpg', 'jpeg', 'png', 'webp'].includes(extensao)) {
      conteudo = `Imagem enviada (${arquivo.type || 'image'}).`
    } else {
      try {
        conteudo = (await arquivo.text()).slice(0, 4000)
      } catch {
        conteudo = ""
      }
    }

    const prompt = `Boleto/nota: arquivo "${arquivo.name}". Data atual: ${new Date().toISOString().slice(0, 10)}.\n\nConteudo do arquivo:\n${conteudo || "(conteudo nao legivel por texto)"}\n\nExtraia os dados e retorne APENAS o JSON.`

    let aiResponse = ""
    try {
      aiResponse = await callOmniroute(prompt, sysPrompt, 8000)
    } catch {
      aiResponse = ""
    }

    let parsed: any = {}
    if (aiResponse) {
      let cleaned = aiResponse.trim()
      const thinkRegex = /<think>[\s\S]*?<\/think>/gi
      cleaned = cleaned.replace(thinkRegex, '').trim()
      if (cleaned.startsWith('<think>')) {
        const endIdx = cleaned.indexOf('</think>')
        if (endIdx >= 0) cleaned = cleaned.slice(endIdx + 8).trim()
        else cleaned = ''
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      try { parsed = JSON.parse(cleaned) } catch {
        const m = cleaned.match(/\{[\s\S]*\}/)
        if (m) try { parsed = JSON.parse(m[0]) } catch {}
      }
    }

    let valor = typeof parsed.valor === 'string' ? parseFloat(parsed.valor.replace(',', '.')) : parseFloat(parsed.valor)
    if (isNaN(valor) || valor < 0) valor = 0

    const vencimento = parsed.vencimento || parsed.data_vencimento || parsed.data || new Date().toISOString().slice(0, 10)
    const diaVenc = parseInt(parsed.dia_vencimento) || parseInt(vencimento.slice(8, 10)) || 10

    const descricao = parsed.descricao || `Boleto: ${arquivo.name}`
    const fornecedor = parsed.fornecedor || null
    const tipoDoc = ["Boleto", "NFe", "Duplicata", "Outro"].includes(parsed.tipo_documento) ? parsed.tipo_documento : "Boleto"

    const { data: categorias } = await admin.from('categorias').select('id, nome').eq('tipo', 'despesa')
    let categoria_id: string | null = null
    const catNome = (parsed.categoria || '').toLowerCase()
    if (catNome && categorias) {
      const achada = categorias.find((c: any) => c.nome.toLowerCase().includes(catNome))
      if (achada) categoria_id = achada.id
    }

    const sugestao = {
      tipo_registro: 'conta_a_pagar',
      tipo: 'despesa',
      valor,
      categoria_id,
      descricao,
      fornecedor,
      tipo_documento: tipoDoc,
      dia_vencimento: diaVenc,
      recorrente: false,
      data_vencimento: vencimento,
    }

    if (pendencia_id) {
      await updatePendencia(admin, pendencia_id, { sugestao })
    }

    return NextResponse.json({ pendencia_id, status: "aguardando", sugestao })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
