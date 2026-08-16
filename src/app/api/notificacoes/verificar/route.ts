import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getContasAVencer, listCarnes } from "@/lib/queries"

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()

  try {
    const hoje = new Date().toISOString().slice(0, 10)

    const contas = await getContasAVencer(supabase, 0)
    const contasPend = (contas || []).filter((c: any) => c.status !== 'pago')

    const carnes = await listCarnes(supabase)
    const estoqueBaixo = (carnes || []).filter((c: any) => parseFloat(c.quantidade_kg || 0) < parseFloat(c.estoque_minimo_kg || 0))

    let msg = `<b>🔔 Panela da Roça — ${new Date().toLocaleDateString('pt-BR')}</b>\n`

    if (contasPend.length > 0) {
      msg += `\n⚠️ <b>Contas a vencer hoje/vencidas:</b>\n`
      for (const c of contasPend.slice(0, 5)) {
        msg += `• ${c.descricao} — ${fmt(c.valor)} (venc ${c.data_vencimento})\n`
      }
    }
    if (estoqueBaixo.length > 0) {
      msg += `\n🥩 <b>Estoque baixo:</b>\n`
      for (const c of estoqueBaixo.slice(0, 5)) {
        msg += `• ${c.nome}: ${parseFloat(c.quantidade_kg).toFixed(1)}kg (mín ${c.estoque_minimo_kg}kg)\n`
      }
    }
    if (contasPend.length === 0 && estoqueBaixo.length === 0) {
      msg += `\n✅ Tudo em dia!`
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) {
      return NextResponse.json({
        enviado: false, motivo: 'Telegram nao configurado (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)',
        data: hoje, contas: contasPend.length, estoque_baixo: estoqueBaixo.length,
      })
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    })
    const ok = res.ok
    return NextResponse.json({
      enviado: ok, data: hoje, contas: contasPend.length, estoque_baixo: estoqueBaixo.length,
      telegram: ok ? 'ok' : `erro ${res.status}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
