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

    const pendencia = await createPendencia(admin, { origem: "foto", payload_bruto: { nome_arquivo: arquivo.name, tamanho: arquivo.size } })
    const pendencia_id = pendencia?.id
    if (pendencia_id) {
      try {
        const buffer = await arquivo.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mimeType = arquivo.type || 'image/jpeg'
        const textoSimulado = `Analise a foto desta nota fiscal/recibo de um restaurante. Extraia e retorne APENAS JSON, sem markdown:
{
  "tipo": "despesa" | "receita",
  "valor": number,
  "descricao": string,
  "data": "YYYY-MM-DD" | null,
  "categoria": string | null
}
Se nao conseguir ler a imagem, retorne {"tipo":"despesa","valor":0,"descricao":"Nao foi possivel ler a imagem","data":null,"categoria":null}`
        const aiResponse = await callOmniroute(textoSimulado, 'Você é um sistema de OCR especializado em notas fiscais e recibos de restaurante. Extraia os dados financeiros da imagem e retorne apenas JSON.', 2000, [{ data: base64, mimeType }])
        let parsed = {}
        try { parsed = JSON.parse(aiResponse.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')) } catch {}
        const tipo = (parsed as any).tipo || 'despesa'
        const valor = parseFloat((parsed as any).valor) || 0
        const descricao = (parsed as any).descricao || `Foto: ${arquivo.name}`
        const { data: categorias } = await admin.from('categorias').select('id').eq('tipo', tipo).limit(1)
        const categoria_id = categorias?.[0]?.id || null
        await updatePendencia(admin, pendencia_id, { sugestao: { tipo_registro: 'lancamento', tipo, valor, categoria_id, descricao, data: (parsed as any).data || new Date().toISOString().slice(0, 10) } })
      } catch (e: any) {
        try {
          await updatePendencia(admin, pendencia_id, { payload_bruto: { ...(pendencia?.payload_bruto || {}), erro: e.message } })
        } catch {}
      }
    }
    return NextResponse.json({ pendencia_id, status: "aguardando" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
