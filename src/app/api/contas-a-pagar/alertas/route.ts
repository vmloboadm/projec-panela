import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getContasAVencer } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const data = await getContasAVencer(supabase, 3)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
