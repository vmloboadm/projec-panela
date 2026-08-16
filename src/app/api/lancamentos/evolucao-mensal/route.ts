import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getLancamentosEvolucaoMensal } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const meses = parseInt(searchParams.get("meses") || "6")
  const supabase = getAdmin()

  try {
    const resultados = await getLancamentosEvolucaoMensal(supabase, meses)
    return NextResponse.json(resultados)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
