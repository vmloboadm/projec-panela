import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { rejeitarPendencia } from "@/lib/queries"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const admin = getAdmin()
  try {
    await rejeitarPendencia(admin, id)
    return NextResponse.json({ pendencia_id: id, status: "rejeitado" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
