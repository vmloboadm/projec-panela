import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateCategoria, deleteCategoria, hasLinkedLancamentos } from "@/lib/queries"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const data = await updateCategoria(supabase, id, body)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const vinculado = await hasLinkedLancamentos(supabase, "categoria_id", id)
    if (vinculado) return NextResponse.json({ error: "Categoria possui lancamentos vinculados" }, { status: 409 })
    await deleteCategoria(supabase, id)
    return NextResponse.json({ message: "Categoria excluida" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
