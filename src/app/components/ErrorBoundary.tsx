'use client'
import { Component, ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="layout" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>😵</div>
          <h2 style={{ color: 'var(--vermelho)', fontSize: 18 }}>Algo deu errado</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 300 }}>{this.state.error?.message || 'Erro inesperado'}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="btn btn-primary" style={{ maxWidth: 200 }}>Tentar novamente</button>
        </div>
      )
    }
    return this.props.children
  }
}
