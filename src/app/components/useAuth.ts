'use client'
import { useEffect, useState, useCallback } from 'react'

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const t = localStorage.getItem('panela_token')
    const u = localStorage.getItem('panela_user')
    if (!t) { window.location.href = '/login.html'; return }
    if (u) try { setUser(JSON.parse(u)) } catch {}

    const refreshToken = localStorage.getItem('panela_refresh')

    const applyToken = (tok: string) => {
      localStorage.setItem('panela_token', tok)
      setToken(tok)
      setLoading(false)
    }

    if (!refreshToken) {
      setToken(t)
      setLoading(false)
      return
    }

    fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).then(res => {
      if (res.status === 401) {
        localStorage.clear()
        window.location.href = '/login.html'
        return
      }
      return res.json()
    }).then((data: any) => {
      if (data?.access_token) {
        applyToken(data.access_token)
        if (data.refresh_token) localStorage.setItem('panela_refresh', data.refresh_token)
        if (data.user) localStorage.setItem('panela_user', JSON.stringify(data.user))
      } else {
        setToken(t)
        setLoading(false)
      }
    }).catch(() => {
      setToken(t)
      setLoading(false)
    })
  }, [])

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
  }), [token])

  const apiGet = useCallback(async (path: string) => {
    const res = await fetch(path, { headers: headers() })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/login.html'; return null }
    return res.json()
  }, [headers])

  const apiPost = useCallback(async (path: string, body?: any) => {
    const res = await fetch(path, { method: 'POST', headers: headers(), body: body ? JSON.stringify(body) : undefined })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/login.html'; return null }
    return res.json()
  }, [headers])

  const apiPut = useCallback(async (path: string, body?: any) => {
    const res = await fetch(path, { method: 'PUT', headers: headers(), body: body ? JSON.stringify(body) : undefined })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/login.html'; return null }
    return res.json()
  }, [headers])

  const apiDelete = useCallback(async (path: string) => {
    const res = await fetch(path, { method: 'DELETE', headers: headers() })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/login.html'; return null }
    return res.json()
  }, [headers])

  const apiUpload = useCallback(async (path: string, formData: FormData) => {
    const res = await fetch(path, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData })
    if (res.status === 401) { localStorage.clear(); window.location.href = '/login.html'; return null }
    return res.json()
  }, [token])

  return { token, user, loading, apiGet, apiPost, apiPut, apiDelete, apiUpload }
}

export async function resolveCategoriaId(
  apiGet: (p: string) => Promise<any>,
  apiPost: (p: string, b?: any) => Promise<any>,
  nome: string,
): Promise<string | undefined> {
  try {
    const cats = await apiGet('/api/categorias')
    if (Array.isArray(cats)) {
      const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const found = cats.find((c: any) => norm(c.nome) === norm(nome))
      if (found?.id) return found.id
    }
    const created = await apiPost('/api/categorias', { nome, tipo: 'despesa', grupo: 'variavel' })
    return created?.id
  } catch {
    return undefined
  }
}

export function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

export function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function todayStr() {
  return hojeBR()
}

export function hojeBR() {
  const d = new Date()
  d.setHours(d.getHours() - 3)
  return d.toISOString().slice(0, 10)
}
