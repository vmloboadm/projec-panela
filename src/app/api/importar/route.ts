import { NextRequest, NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { createLancamentosBatch } from "@/lib/queries"
import { csvRowSchema } from "@/lib/schemas"

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue }
    if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += char
  }
  result.push(current.trim())
  return result
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const admin = getAdmin()
  const formData = await request.formData()
  const arquivo = formData.get("arquivo") as File | null
  if (!arquivo) return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 })

  const texto = await arquivo.text()
  const linhas = texto.split(/\r?\n/).filter(l => l.trim())
  if (linhas.length < 2) return NextResponse.json({ error: "CSV vazio ou invalido" }, { status: 400 })

  const cabecalho = parseCSVLine(linhas[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
  const colIndex = (name: string) => cabecalho.indexOf(name)

  const importados: any[] = []
  const erros: any[] = []

  for (let i = 1; i < linhas.length; i++) {
    const cols = parseCSVLine(linhas[i])
    const raw = {
      linha: i + 1,
      data: cols[colIndex('data')] || '',
      tipo: cols[colIndex('tipo')] || '',
      valor: cols[colIndex('valor')] || '0',
      categoria: cols[colIndex('categoria')] || cols[colIndex('categorias')] || '',
      descricao: cols[colIndex('descricao')] || cols[colIndex('descricao')] || '',
      conta: cols[colIndex('conta')] || cols[colIndex('contas')] || '',
    }

    const parsed = csvRowSchema.safeParse(raw)
    if (!parsed.success) {
      erros.push({ linha: i + 1, erro: parsed.error.issues.map(i => i.message).join('; ') })
      continue
    }

    const row = parsed.data
    const valor = typeof row.valor === 'string' ? parseFloat(row.valor.replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0 : row.valor

    let categoria_id: string | null = null
    let conta_id: string | null = null

    if (row.categoria) {
      const { data: cat } = await admin.from("categorias").select("id").ilike("nome", `%${row.categoria}%`).limit(1)
      if (cat && cat.length > 0) categoria_id = cat[0].id
    }
    if (row.conta) {
      const { data: con } = await admin.from("contas").select("id").ilike("nome", `%${row.conta}%`).limit(1)
      if (con && con.length > 0) conta_id = con[0].id
    }

    try {
      const lanc = await createLancamentosBatch(admin, [{
        tipo: row.tipo,
        valor,
        categoria_id,
        conta_id,
        data: row.data || new Date().toISOString().slice(0, 10),
        descricao: row.descricao || `Importado: ${row.categoria || row.tipo}`,
        origem: "importacao_csv",
      }])
      importados.push(lanc?.[0])
    } catch (err: any) {
      erros.push({ linha: i + 1, erro: err.message })
    }
  }

  return NextResponse.json({
    total: linhas.length - 1,
    importados: importados.length,
    erros: erros.length,
    detalhes_erros: erros.slice(0, 5),
  })
}
