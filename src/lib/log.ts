export function logEvent(event: string, data: Record<string, unknown> = {}) {
  try {
    const linha = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data,
    })
    if (event === 'erro') {
      console.error(linha)
    } else {
      console.log(linha)
    }
  } catch {
    console.error(JSON.stringify({ ts: new Date().toISOString(), event: 'log_event_falhou', raw: String(data) }))
  }
}

export function logErro(event: string, err: unknown, contexto: Record<string, unknown> = {}) {
  const errObj = err instanceof Error ? { mensagem: err.message, stack: err.stack } : { mensagem: String(err) }
  logEvent(event, { ...contexto, erro: errObj })
}
