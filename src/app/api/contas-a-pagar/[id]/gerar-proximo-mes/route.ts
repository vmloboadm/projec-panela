import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { gerarProximoMesConta } from "@/lib/queries"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const data = await gerarProximoMesConta(supabase, id)
    return NextResponse.json({ success: true, conta: data }, { status: 201 })
  } catch (e: any) {
    const status = (e?.message || "").includes("não encontrada") || (e?.message || "").includes("nao encontrada") ? 404 : 400
    return NextResponse.json({ error: e.message }, { status })
  }
}
