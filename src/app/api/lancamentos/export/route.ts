import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getLancamentosExport } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const supabase = getAdmin()

  try {
    const data = await getLancamentosExport(supabase, {
      data_inicio: searchParams.get("data_inicio") || undefined,
      data_fim: searchParams.get("data_fim") || undefined,
      tipo: searchParams.get("tipo") || undefined,
    })

    const linhas = ["data,tipo,categoria,conta,descricao,valor"]
    for (const r of data) {
      const cat = r.categoria_nome || ""
      const con = r.conta_nome || ""
      linhas.push(`${r.data},${r.tipo},"${cat}","${con}","${r.descricao || ""}",${r.valor}`)
    }

    return new NextResponse(linhas.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=lancamentos.csv",
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
