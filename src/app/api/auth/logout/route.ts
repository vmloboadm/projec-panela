import { NextResponse } from 'next/server'
import { requireAuth } from "@/lib/api"
export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({ message: "Logout realizado" })
}
