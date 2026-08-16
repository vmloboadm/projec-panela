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

    const pendencia = await createPendencia(admin, { origem: "audio", payload_bruto: { nome_arquivo: arquivo.name, tamanho: arquivo.size } })
    const pendencia_id = pendencia?.id
    if (pendencia_id) {
      try {
        const textoSimulado = `Transcrição de áudio: arquivo ${arquivo.name}. Extraia o lançamento financeiro.`
        const aiResponse = await callOmniroute(textoSimulado)
        let parsed = {}
        try { parsed = JSON.parse(aiResponse) } catch {}
        const tipo = (parsed as any).tipo || 'despesa'
        const valor = parseFloat((parsed as any).valor) || 0
        const descricao = (parsed as any).descricao || `Audio: ${arquivo.name}`
        const { data: categorias } = await admin.from('categorias').select('id').eq('tipo', tipo).limit(1)
        const categoria_id = categorias?.[0]?.id || null
        await updatePendencia(admin, pendencia_id, { sugestao: { tipo_registro: 'lancamento', tipo, valor, categoria_id, descricao, data: new Date().toISOString().slice(0, 10) } })
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
