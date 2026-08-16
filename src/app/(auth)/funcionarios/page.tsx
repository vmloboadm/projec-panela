'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { Loading, EmptyState, Modal } from '@/app/components/Shared'

const TIPOS_PAGAMENTO = [
  { value: 'quinzena', label: 'Quinzena' },
  { value: 'salario', label: 'Salário' },
  { value: 'extra', label: 'Extra' },
  { value: 'adiantamento', label: 'Adiantamento' },
]

export default function FuncionariosPage() {
  const { loading: authLoading, apiGet, apiPost, apiPut, apiDelete } = useAuth()
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [dados, setDados] = useState<any>(null)
  const [carregando, setCarregando] = useState(false)
  const [modalCadastro, setModalCadastro] = useState(false)
  const [modalPagamento, setModalPagamento] = useState<any>(null)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', cargo: 'Funcionário', salario_base: '' })
  const [formPag, setFormPag] = useState({ data: new Date().toISOString().slice(0, 10), tipo: 'quinzena', valor: '', descricao: '' })
  const [aviso, setAviso] = useState<string | null>(null)
  const [savings, setSavings] = useState(false)

  const carregar = useCallback(async (m: string) => {
    setCarregando(true)
    const res = await apiGet(`/api/funcionarios?mes=${m}`)
    setDados(res)
    setCarregando(false)
  }, [apiGet])

  useEffect(() => {
    if (authLoading) return
    carregar(mes)
  }, [authLoading, mes, carregar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2500)
    return () => clearTimeout(t)
  }, [aviso])

  function abrirCadastro(func?: any) {
    if (func) {
      setEditando(func)
      setForm({ nome: func.nome, cargo: func.cargo || 'Funcionário', salario_base: String(func.salario_base || '') })
    } else {
      setEditando(null)
      setForm({ nome: '', cargo: 'Funcionário', salario_base: '' })
    }
    setModalCadastro(true)
  }

  async function salvarFuncionario() {
    if (!form.nome.trim()) { setAviso('Digite o nome do funcionário'); return }
    setSavings(true)
    const payload = { nome: form.nome.trim(), cargo: form.cargo, salario_base: parseFloat(form.salario_base) || 0 }
    const res = editando
      ? await apiPut(`/api/funcionarios/${editando.id}`, payload)
      : await apiPost('/api/funcionarios', payload)
    setSavings(false)
    if (res?.error) { setAviso(res.error); return }
    setModalCadastro(false)
    setAviso(editando ? 'Funcionário atualizado' : 'Funcionário cadastrado')
    carregar(mes)
  }

  async function excluirFuncionario(func: any) {
    if (!window.confirm(`Excluir ${func.nome}? Os pagamentos dele também serão apagados.`)) return
    const res = await apiDelete(`/api/funcionarios/${func.id}`)
    if (res?.error) { setAviso(res.error); return }
    setAviso('Funcionário excluído')
    carregar(mes)
  }

  function abrirPagamento(func: any) {
    setModalPagamento(func)
    setFormPag({ data: new Date().toISOString().slice(0, 10), tipo: 'quinzena', valor: '', descricao: '' })
  }

  async function salvarPagamento() {
    if (!formPag.valor || parseFloat(formPag.valor) <= 0) { setAviso('Informe o valor do pagamento'); return }
    setSavings(true)
    const res = await apiPost('/api/funcionarios/pagamentos', {
      funcionario_id: modalPagamento.id,
      data: formPag.data,
      tipo: formPag.tipo,
      valor: parseFloat(formPag.valor),
      descricao: formPag.descricao || null,
    })
    setSavings(false)
    if (res?.error) { setAviso(res.error); return }
    setModalPagamento(null)
    setAviso('Pagamento registrado')
    carregar(mes)
  }

  const totalSalarios = dados?.funcionarios?.reduce((a: number, f: any) => a + (f.salario_base || 0), 0) || 0
  const totalPago = dados?.funcionarios?.reduce((a: number, f: any) => a + (f.pago_mes || 0), 0) || 0

  if (authLoading && !dados) return <Loading />

  return (
    <div style={{ padding: 16, paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>👥 Funcionários</span>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="form-input" style={{ marginLeft: 'auto', width: 130, fontSize: 12, padding: '6px 8px' }} />
        <button onClick={() => abrirCadastro()} className="btn-primary" style={{ fontSize: 12, padding: '8px 12px' }}>+ Novo</button>
      </div>

      {aviso && <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: 'var(--verde)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.3)' }}>{aviso}</div>}

      {carregando && !dados ? <Loading /> : !dados?.funcionarios?.length ? (
        <EmptyState msg="Nenhum funcionário cadastrado" cta="Toque em <b>+ Novo</b> para cadastrar o primeiro." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Folha do mês</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{fmtCurrency(totalSalarios)}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pago no mês</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--verde)' }}>{fmtCurrency(totalPago)}</div>
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>A pagar</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: totalSalarios - totalPago > 0 ? 'var(--vermelho)' : 'var(--verde)' }}>{fmtCurrency(totalSalarios - totalPago)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dados.funcionarios.map((f: any) => {
              const falta = f.falta_pagar || 0
              const pct = f.salario_base > 0 ? Math.min(Math.round((f.pago_mes / f.salario_base) * 100), 100) : 0
              return (
                <div key={f.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'oklch(62% 0.14 45 / .15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{f.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.cargo} · Salário {fmtCurrency(f.salario_base)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: falta > 0 ? 'var(--vermelho)' : 'var(--verde)' }}>
                        {falta > 0 ? `Falta ${fmtCurrency(falta)}` : 'Pago ✓'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Pago {fmtCurrency(f.pago_mes)}</div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg)', borderRadius: 6, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: falta > 0 ? 'oklch(62% 0.14 45 / .7)' : 'var(--verde)', borderRadius: 6, transition: 'width .4s' }} />
                  </div>
                  {f.pagamentos?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {f.pagamentos.map((p: any, i: number) => (
                        <span key={i} style={{ fontSize: 11, background: 'var(--bg)', padding: '4px 8px', borderRadius: 8, color: 'var(--muted)' }}>
                          {p.data?.slice(8)} · {p.tipo} · {fmtCurrency(p.valor)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => abrirPagamento(f)} className="btn-primary" style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}>💰 Pagamento</button>
                    <button onClick={() => abrirCadastro(f)} style={{ fontSize: 12, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => excluirFuncionario(f)} style={{ fontSize: 12, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--vermelho)' }}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {modalCadastro && (
        <Modal titulo={editando ? 'Editar funcionário' : 'Novo funcionário'} onClose={() => setModalCadastro(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nome</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do funcionário" className="form-input" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Cargo</label>
              <input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} className="form-input" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Salário base (R$)</label>
              <input value={form.salario_base} onChange={e => setForm({ ...form, salario_base: e.target.value })} type="number" step="0.01" placeholder="0.00" className="form-input" />
            </div>
            <button onClick={salvarFuncionario} className="btn-primary" disabled={savings} style={{ marginTop: 6 }}>
              {savings ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </Modal>
      )}

      {modalPagamento && (
        <Modal titulo={`Pagamento · ${modalPagamento.nome}`} onClose={() => setModalPagamento(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Data</label>
              <input type="date" value={formPag.data} onChange={e => setFormPag({ ...formPag, data: e.target.value })} className="form-input" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Tipo</label>
              <select value={formPag.tipo} onChange={e => setFormPag({ ...formPag, tipo: e.target.value })} className="form-select">
                {TIPOS_PAGAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Valor (R$)</label>
              <input value={formPag.valor} onChange={e => setFormPag({ ...formPag, valor: e.target.value })} type="number" step="0.01" placeholder="0.00" className="form-input" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Observação (opcional)</label>
              <input value={formPag.descricao} onChange={e => setFormPag({ ...formPag, descricao: e.target.value })} placeholder="ex.: 2ª quinzena" className="form-input" />
            </div>
            <button onClick={salvarPagamento} className="btn-primary" disabled={savings} style={{ marginTop: 6 }}>
              {savings ? 'Registrando...' : 'Registrar pagamento'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
