import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { listContasAPagar, createContaAPagar, getContasResumoMes, listFornecedores } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const supabase = getAdmin()
  try {
    const mes = searchParams.get("mes") || undefined
    if (searchParams.get("resumo") === "true") {
      const resumo = await getContasResumoMes(supabase, mes || new Date().toISOString().slice(0, 7))
      return NextResponse.json(resumo)
    }
    if (searchParams.get("fornecedores") === "true") {
      const fornecedores = await listFornecedores(supabase)
      return NextResponse.json(fornecedores)
    }
    const data = await listContasAPagar(supabase, {
      status: searchParams.get("status") || undefined,
      mes,
      fornecedor: searchParams.get("fornecedor") || undefined,
      tipo_documento: searchParams.get("tipo_documento") || undefined,
      busca: searchParams.get("busca") || undefined,
    })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const body = await request.json()
    if (!body.descricao || !body.valor) {
      return NextResponse.json({ error: "descricao e valor obrigatorios" }, { status: 400 })
    }
    const data = await createContaAPagar(supabase, body)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
