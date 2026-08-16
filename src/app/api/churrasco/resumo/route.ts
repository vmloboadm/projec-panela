import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getResumoConsumo } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const { searchParams } = new URL(request.url)
    const dias = searchParams.get("dias") ? parseInt(searchParams.get("dias")!) : undefined
    const corte_id = searchParams.get("corte_id") || undefined
    const data = await getResumoConsumo(supabase, {
      dias: dias && !isNaN(dias) ? dias : undefined,
      corte_id,
    })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
