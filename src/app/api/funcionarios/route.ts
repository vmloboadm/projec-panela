import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { listFuncionarios, createFuncionario } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7)
  try {
    const data = await listFuncionarios(supabase, mes)
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
    const data = await createFuncionario(supabase, body)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
