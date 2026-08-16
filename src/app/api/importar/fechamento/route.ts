import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"

const FORMAS = [
  { nome: "credito", keys: ["credit", "crédito", "cartao credito", "master", "visa"] },
  { nome: "debito", keys: ["debit", "débito", "cartao debito"] },
  { nome: "pix", keys: ["pix"] },
  { nome: "vale", keys: ["vale", "refeiç", "refeic", "ticket", "sodexo", "alelo", "vr "] },
  { nome: "delivery", keys: ["delivery", "ifood", "99", "uber eats", "entreg", "aplicativo"] },
  { nome: "dinheiro", keys: ["dinheiro", "cash", "especie", "espécie"] },
]

function detectarForma(texto: string): string {
  const t = (texto || '').toLowerCase()
  for (const f of FORMAS) if (f.keys.some(k => t.includes(k))) return f.nome
  return "outros"
}

function parseCSV(conteudo: string) {
  const linhasBrutas = conteudo.split(/\r?\n/).filter(l => l.trim())
  const linhas = linhasBrutas.map(l => {
    const partes = l.split(/[;,]/).map(p => p.replace(/^"|"$/g, '').trim())
    return partes
  })
  const header = linhas[0] || []
  const idxValor = header.findIndex(h => /valor|total|preco|r\$|r /i.test(h))
  const idxDesc = header.findIndex(h => /desc|produto|nome|item/i.test(h))
  const idxForma = header.findIndex(h => /forma|pagamento|pag|tipo/i.test(h))
  const idxData = header.findIndex(h => /data|dt/i.test(h))
  const corpo = (idxValor >= 0 ? linhas.slice(1) : linhas)
  const linhasOut: any[] = []
  for (const l of corpo) {
    const numIdx = idxValor >= 0 ? idxValor : l.findIndex(p => /^\d+(?:[.,]\d+)?$/.test(p.replace(/[R$\s]/g, '')))
    const valorRaw = (numIdx >= 0 ? l[numIdx] : '').replace(/[R$\s]/g, '').replace(',', '.')
    const valor = parseFloat(valorRaw)
    if (isNaN(valor)) continue
    const textoLinha = l.join(' ')
    const descricao = idxDesc >= 0 && l[idxDesc] ? l[idxDesc] : textoLinha.slice(0, 60)
    linhasOut.push({
      data: idxData >= 0 && l[idxData] ? l[idxData] : null,
      descricao,
      valor,
      forma: idxForma >= 0 && l[idxForma] ? detectarForma(l[idxForma]) : detectarForma(textoLinha),
    })
  }
  return linhasOut
}

function parseTextoPDF(texto: string) {
  const linhas: any[] = []
  const reValor = /R\$\s*(\d+(?:[.,]\d{2})?)|(\d{1,3}(?:\.\d{3})*,\d{2})/gi
  for (const linha of texto.split(/\r?\n/)) {
    const l = linha.trim()
    if (!l) continue
    const m = l.match(reValor)
    if (!m) continue
    const last = m[m.length - 1]
    const raw = last.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
    const valor = parseFloat(raw)
    if (isNaN(valor) || valor <= 0) continue
    linhas.push({ descricao: l.replace(last, '').trim().slice(0, 60) || 'Item', valor, forma: detectarForma(l) })
  }
  return linhas
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const form = await request.formData()
    const file = form.get('arquivo') as File | null
    if (!file) return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400 })

    const nome = (file.name || '').toLowerCase()
    const bytes = new Uint8Array(await file.arrayBuffer())

    if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
      const conteudo = new TextDecoder().decode(bytes)
      const linhas = parseCSV(conteudo)
      return NextResponse.json({ tipo: 'csv', total: linhas.length, linhas })
    }

    if (nome.endsWith('.pdf')) {
      const pdfParse: any = await import('pdf-parse')
      const { text } = await pdfParse(Buffer.from(bytes))
      const linhas = parseTextoPDF(text)
      return NextResponse.json({ tipo: 'pdf', total: linhas.length, linhas })
    }

    return NextResponse.json({ error: "Formato nao suportado (use CSV ou PDF)" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: "Erro ao importar: " + e.message }, { status: 500 })
  }
}
