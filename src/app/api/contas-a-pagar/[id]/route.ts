import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateContaAPagar, deleteContaAPagar } from "@/lib/queries"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const data = await updateContaAPagar(supabase, id, body)
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
    const { data: conta } = await supabase.from("contas_a_pagar").select("lancamento_id").eq("id", id).single()
    if (conta?.lancamento_id) {
      await supabase.from("lancamentos").update({ deleted_at: new Date().toISOString() }).eq("id", conta.lancamento_id)
    }
    await deleteContaAPagar(supabase, id)
    return NextResponse.json({ message: "Conta a pagar excluida" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
