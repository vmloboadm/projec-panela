import { NextResponse } from "next/server"
import { getAdmin } from "@/lib/api"

export async function GET() {
  const checks: Record<string, any> = {}
  let allOk = true

  // Check database
  try {
    const supabase = getAdmin()
    const { data, error } = await supabase.from("lancamentos").select("id", { count: "exact", head: true }).limit(1)
    checks.database = error ? `error: ${error.message}` : true
    if (error) allOk = false
  } catch (e: any) {
    checks.database = `error: ${e.message}`
    allOk = false
  }

  // Check AI
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${process.env.OMNIRoute_API_URL || ''}/models`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    checks.ai = res.ok ? true : `http ${res.status}`
    if (!res.ok) allOk = false
  } catch (e: any) {
    checks.ai = `error: ${e.message}`
    allOk = false
  }

  // Check disk (can write)
  try {
    const fs = await import('fs')
    fs.accessSync('/tmp', fs.constants?.W_OK || 2)
    checks.disk = true
  } catch { checks.disk = false; allOk = false }

  // Check memory (basic)
  const mem = process.memoryUsage()
  checks.memory_mb = Math.round(mem.heapUsed / 1024 / 1024)

  // Check uptime
  checks.uptime_seconds = Math.floor(process.uptime())

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 })
}
