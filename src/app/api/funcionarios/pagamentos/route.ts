import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { registrarPagamentoFuncionario, listPagamentosFuncionario } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  const { searchParams } = new URL(request.url)
  const funcionarioId = searchParams.get("funcionario_id")
  const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7)
  try {
    if (funcionarioId) {
      const data = await listPagamentosFuncionario(supabase, funcionarioId, mes)
      return NextResponse.json(data)
    }
    const { data, error } = await supabase
      .from("funcionario_pagamentos")
      .select("id, funcionario_id, data, tipo, valor, descricao, created_at")
      .gte("data", mes + "-01")
      .lte("data", mes + "-31")
      .order("data", { ascending: false })
    if (error) throw error
    return NextResponse.json(data || [])
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
    const data = await registrarPagamentoFuncionario(supabase, body)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
