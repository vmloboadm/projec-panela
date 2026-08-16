import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { updateFuncionario, deleteFuncionario } from "@/lib/queries"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const supabase = getAdmin()
  try {
    const body = await request.json()
    const data = await updateFuncionario(supabase, id, body)
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
    await deleteFuncionario(supabase, id)
    return NextResponse.json({ message: "Funcionário excluído" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
