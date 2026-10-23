import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { CustoForm } from './CustoForm'
import { HorasForm } from './HorasForm'
import { TimerBar } from './TimerBar'
import { Modal } from './ui'

const nav = [
  ['/', 'Painel'],
  ['/projetos', 'Projetos'],
  ['/clientes', 'Clientes'],
  ['/relatorios', 'Relatórios'],
  ['/configuracoes', 'Configurações'],
]

export function Layout() {
  const { usuario, sair } = useAuth()
  const [fab, setFab] = useState(false)
  const [lancar, setLancar] = useState<'hora' | 'custo' | null>(null)

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-semibold text-blue-700">Controle de Projetos</Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
            {nav.map(([to, nome]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 ${isActive ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                {nome}
              </NavLink>
            ))}
          </nav>
          <button className="text-xs text-slate-500 hover:text-slate-800" onClick={sair} title={usuario?.email}>
            Sair
          </button>
        </div>
      </header>
      <TimerBar />
      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>

      {/* Botão flutuante: lançar hora ou custo de qualquer tela */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {fab && (
          <>
            <button className="btn-secondary shadow-lg" onClick={() => { setLancar('custo'); setFab(false) }}>+ Custo</button>
            <button className="btn-secondary shadow-lg" onClick={() => { setLancar('hora'); setFab(false) }}>+ Horas</button>
          </>
        )}
        <button
          className="h-14 w-14 rounded-full bg-blue-600 text-3xl text-white shadow-xl hover:bg-blue-700"
          onClick={() => setFab(!fab)}
          aria-label="Novo lançamento"
        >
          {fab ? '×' : '+'}
        </button>
      </div>

      {lancar === 'hora' && (
        <Modal titulo="Lançar horas" onClose={() => setLancar(null)}>
          <HorasForm onSalvo={() => { setLancar(null); location.reload() }} />
        </Modal>
      )}
      {lancar === 'custo' && (
        <Modal titulo="Lançar custo" onClose={() => setLancar(null)}>
          <CustoForm onSalvo={() => { setLancar(null); location.reload() }} />
        </Modal>
      )}
    </div>
  )
}
