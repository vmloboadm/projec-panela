import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getAlertasChurrasco } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const data = await getAlertasChurrasco(supabase)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
