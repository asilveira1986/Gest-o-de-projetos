import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { ABAS_PROJETO } from '../lib/abas'
import { useAuth } from '../lib/auth'
import { Busca } from './Busca'
import { CustoForm } from './CustoForm'
import { HorasForm } from './HorasForm'
import { TimerBar } from './TimerBar'
import { Modal } from './ui'

const Ico = ({ d }: { d: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)
const nav: [string, string, ReactNode][] = [
  ['/', 'Hoje', <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>],
  ['/painel', 'Painel', <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>],
  ['/projetos', 'Projetos', <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>],
  ['/clientes', 'Clientes', <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 20a6 6 0 0 0-2.5-4.9" /></>],
  ['/faturamento', 'Faturamento', <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v.01M18 14.5v.01" /></>],
  ['/relatorios', 'Relatórios', <><path d="M5 3h10l4 4v14H5z" /><path d="M14 3v5h5M8 13h8M8 17h5" /></>],
  ['/configuracoes', 'Configurações', <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>],
]

function Marca() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-900/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      </span>
      <span className="leading-tight"><span className="block text-sm font-bold text-white">Controle de</span><span className="block text-sm font-bold text-brand-300">Projetos</span></span>
    </Link>
  )
}

export function Layout() {
  const { usuario, sair } = useAuth()
  const [fab, setFab] = useState(false)
  const [lancar, setLancar] = useState<'hora' | 'custo' | null>(null)
  const [busca, setBusca] = useState(false)

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBusca((b) => !b) }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  const emProjeto = useMatch({ path: '/projetos/:id', end: false })
  const { pathname } = useLocation()
  const abaAtiva = pathname.split('/')[3] || 'resumo'
  const inicial = (usuario?.nome ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-ink-900 to-ink-950 p-4 lg:flex">
        <div className="px-2 py-3"><Marca /></div>
        <button onClick={() => setBusca(true)} className="mt-4 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-400 transition hover:bg-white/10">
          <span>Buscar…</span><kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">Ctrl K</kbd>
        </button>
        <nav className="mt-4 flex-1 space-y-1">
          {nav.map(([to, nome, ico]) => (
            <div key={to}>
              <NavLink to={to} end={to === '/'}
                className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                <Ico d={ico} />{nome}
              </NavLink>
              {to === '/projetos' && emProjeto && (
                <div className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {ABAS_PROJETO.map(([k, rotulo]) => (
                    <Link key={k} to={`/projetos/${emProjeto.params.id}/${k}`}
                      className={`block rounded-md px-3 py-1.5 text-sm transition ${abaAtiva === k ? 'bg-white/10 font-medium text-brand-300' : 'text-slate-400 hover:text-white'}`}>{rotulo}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">{inicial}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{usuario?.nome}</p><button onClick={sair} className="text-xs text-slate-400 hover:text-white">Sair</button></div>
        </div>
      </aside>

      {/* Topo (mobile) */}
      <header className="sticky top-0 z-30 bg-ink-900 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3"><Marca /><div className="flex items-center gap-4"><button onClick={() => setBusca(true)} className="text-xs text-slate-300" aria-label="Buscar">🔍</button><button onClick={sair} className="text-xs text-slate-300">Sair</button></div></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {nav.map(([to, nome]) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${isActive ? 'bg-brand-500 text-white' : 'text-slate-300'}`}>{nome}</NavLink>
          ))}
        </nav>
      </header>

      <div className="sticky top-0 z-20 lg:top-0"><TimerBar /></div>
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:px-8"><Outlet /></main>

      {/* Botão flutuante: lançar hora ou custo de qualquer tela */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {fab && (<>
          <button className="btn-secondary !rounded-full !px-4 shadow-lg" onClick={() => { setLancar('custo'); setFab(false) }}>💰 Custo</button>
          <button className="btn-secondary !rounded-full !px-4 shadow-lg" onClick={() => { setLancar('hora'); setFab(false) }}>⏱ Horas</button>
        </>)}
        <button className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-3xl text-white shadow-xl shadow-brand-900/30 transition hover:scale-105"
          onClick={() => setFab(!fab)} aria-label="Novo lançamento">{fab ? '×' : '+'}</button>
      </div>

      <Busca aberta={busca} onFechar={() => setBusca(false)} onLancar={setLancar} />
      {lancar === 'hora' && <Modal titulo="Lançar horas" onClose={() => setLancar(null)}><HorasForm onSalvo={() => { setLancar(null); location.reload() }} /></Modal>}
      {lancar === 'custo' && <Modal titulo="Lançar custo" onClose={() => setLancar(null)}><CustoForm onSalvo={() => { setLancar(null); location.reload() }} /></Modal>}
    </div>
  )
}
