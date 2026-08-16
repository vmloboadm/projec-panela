import { NextResponse } from "next/server"
import { getAdmin } from "@/lib/api"
import { readFileSync } from "fs"
import { join } from "path"

export async function GET() {
  const supabase = getAdmin()
  try {
    const { error } = await supabase.rpc("pagar_conta", {
      p_conta_id: "00000000-0000-0000-0000-000000000000",
      p_descricao: "test",
      p_valor: 1,
      p_data: "2026-01-01",
    })
    return NextResponse.json({ installed: !error })
  } catch {
    return NextResponse.json({ installed: false })
  }
}

export async function POST() {
  const sqlPath = join(process.cwd(), "supabase/migrations/20240730000003_pagar_conta_rpc.sql")
  const sql = readFileSync(sqlPath, "utf-8")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SERVICE_ROLE_KEY

  if (supabaseUrl && serviceKey) {
    try {
      const projectRef = supabaseUrl.replace("https://", "").split(".")[0]
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: sql }),
      })
      if (res.ok) return NextResponse.json({ applied: true })
    } catch {}
  }

  return NextResponse.json({
    applied: false,
    sql,
    sql_resumo: sql.split("\n").slice(0, 5).join("\n") + "\n...",
  })
}
