import { useEffect, type ReactNode } from 'react'
import type { AlertaOrcamento } from '../lib/calc'

export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button className="text-2xl leading-none text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Campo({ rotulo, children, className = '' }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-600">{rotulo}</span>
      {children}
    </label>
  )
}

export function Erro({ msg }: { msg: string | null }) {
  return msg ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p> : null
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>
}

export function Carregando() {
  return <p className="p-6 text-center text-sm text-slate-500">Carregando…</p>
}

const COR_ALERTA: Record<AlertaOrcamento, string> = {
  ok: 'bg-brand-500',
  amarelo: 'bg-amber-500',
  vermelho: 'bg-red-600',
}

export function BarraOrcamento({ pct, alerta }: { pct: number; alerta: AlertaOrcamento }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={`h-full ${COR_ALERTA[alerta]}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export function Selo({ children, cor = 'slate' }: { children: ReactNode; cor?: 'slate' | 'blue' | 'green' | 'amber' | 'red' }) {
  const c = {
    slate: 'bg-ink-100 text-ink-700',
    blue: 'bg-brand-100 text-brand-700',
    green: 'bg-brand-100 text-brand-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
  }[cor]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>
}

export function Indicador({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="card relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-400 to-brand-600" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight text-ink-900 ${cor ?? ''}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
