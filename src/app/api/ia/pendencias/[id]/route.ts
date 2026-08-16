import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getPendencia } from "@/lib/queries"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const data = await getPendencia(supabase, id)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Pendencia nao encontrada" }, { status: 404 })
  }
}
