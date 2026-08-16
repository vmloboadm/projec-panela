'use client'
import { useEffect, useState } from 'react'

export default function PinLock({ children }: { children: React.ReactNode }) {
  const [pin, setPin] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState(false)

  useEffect(() => {
    const p = localStorage.getItem('panela_pin')
    setPin(p)
  }, [])

  if (pin && sessionStorage.getItem('panela_unlocked') !== '1') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Acesso Rápido</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Digite seu PIN para abrir o caixa</div>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={valor}
            onChange={e => { setValor(e.target.value); setErro(false) }}
            onKeyDown={e => { if (e.key === 'Enter') validar() }}
            style={{ width: '100%', textAlign: 'center', fontSize: 24, letterSpacing: 8, padding: '10px 0', borderRadius: 8, border: `1px solid ${erro ? 'var(--vermelho)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)' }}
          />
          {erro && <div style={{ color: 'var(--vermelho)', fontSize: 12, marginTop: 8 }}>PIN incorreto</div>}
          <button onClick={validar} style={{ width: '100%', marginTop: 14, padding: '12px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Entrar</button>
          <button onClick={trocarUsuario} style={{ width: '100%', marginTop: 8, padding: '8px', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Trocar de usuário</button>
        </div>
      </div>
    )
  }

  return <>{children}</>

  function validar() {
    if (valor === pin) {
      sessionStorage.setItem('panela_unlocked', '1')
      setPin(null)
    } else {
      setErro(true)
      setValor('')
    }
  }

  function trocarUsuario() {
    localStorage.clear()
    sessionStorage.removeItem('panela_unlocked')
    window.location.href = '/login.html'
  }
}
