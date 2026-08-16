import { NextResponse } from "next/server"
import { callOmniroute, requireAuth } from "@/lib/api"

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  try {
    const formData = await request.formData()
    const arquivo = formData.get("arquivo") as File | null
    if (!arquivo) return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 })

    const buffer = await arquivo.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = arquivo.type
    const nome = arquivo.name
    const extensao = nome.split('.').pop()?.toLowerCase() || ''

    if (['csv', 'txt'].includes(extensao)) {
      const texto = await arquivo.text()
      const linhas = texto.split('\n').filter(l => l.trim())
      const prompt = `Analise este arquivo CSV/TXT com dados financeiros de um restaurante:

${texto.slice(0, 2000)}

Extraia os totais de vendas e retorne JSON:
{
  "vendas_dinheiro": number,
  "vendas_cartao_credito": number,
  "vendas_cartao_debito": number,
  "vendas_pix": number,
  "total_vendas": number,
  "clientes_atendidos": number | null,
  "tipo_arquivo": "csv_pdv" | "desconhecido"
}

Se nao conseguir extrair, mantenha valores como 0.`
      const aiResp = await callOmniroute(prompt, 'Você é um sistema de leitura de arquivos de frente de caixa de restaurante. Analise CSV/TXT e extraia valores financeiros.')
      let parsed = {}
      try { parsed = JSON.parse(aiResp.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')) } catch {}

      return NextResponse.json({
        arquivo: nome,
        tipo: 'csv',
        linhas: linhas.length,
        dados: parsed,
        raw_preview: texto.slice(0, 500)
      })
    }

    if (['jpg', 'jpeg', 'png', 'webp'].includes(extensao)) {
      const prompt = `Analise esta imagem de comprovante/boleto/nota fiscal de restaurante.

Extraia os dados financeiros e retorne JSON:
{
  "tipo_documento": "boleto" | "nota_fiscal" | "comprovante" | "desconhecido",
  "valor": number | null,
  "descricao": string | null,
  "data": "YYYY-MM-DD" | null,
  "vencimento": "YYYY-MM-DD" | null,
  "fornecedor": string | null,
  "forma_pagamento": string | null
}

Se nao conseguir ler, retorne { "erro": "Nao foi possivel extrair dados desta imagem" }`
      const aiResp = await callOmniroute(prompt, 'Você é um sistema de OCR especializado em documentos financeiros. Analise a imagem e extraia dados.', 2000, [{ data: base64, mimeType }])
      let parsed = {}
      try { parsed = JSON.parse(aiResp.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')) } catch {}

      return NextResponse.json({
        arquivo: nome,
        tipo: 'imagem',
        dados: parsed
      })
    }

    return NextResponse.json({ error: "Formato de arquivo nao suportado: " + extensao }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
