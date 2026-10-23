import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtRelogio } from '../lib/format'
import { listarAtivos, pausar, retomar, segundos, type Ativo } from '../lib/timer'
import { useAuth } from '../lib/auth'
import { PararModal } from './PararModal'

/** Hook compartilhado: lista de cronômetros do usuário, atualizada a cada segundo. */
export function useAtivos() {
  const { usuario } = useAuth()
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [, tick] = useState(0)

  const carregar = () => {
    if (usuario) void listarAtivos(usuario.id).then(setAtivos).catch(() => {})
  }
  useEffect(carregar, [usuario])
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    const r = setInterval(carregar, 30000)
    window.addEventListener('timer-mudou', carregar)
    return () => {
      clearInterval(t)
      clearInterval(r)
      window.removeEventListener('timer-mudou', carregar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])
  return ativos
}

export const avisarTimer = () => window.dispatchEvent(new Event('timer-mudou'))

export function TimerBar() {
  const { usuario } = useAuth()
  const ativos = useAtivos()
  const [parando, setParando] = useState<Ativo | null>(null)
  if (!ativos.length || !usuario) return null

  return (
    <div className="border-b border-blue-200 bg-blue-50">
      {ativos.map((a) => (
        <div key={a.id} className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${a.estado === 'rodando' ? 'animate-pulse bg-red-500' : 'bg-amber-500'}`} />
          <span className="font-mono text-base font-semibold">{fmtRelogio(segundos(a))}</span>
          <Link className="flex-1 truncate text-blue-700 hover:underline" to={`/tarefas/${a.tarefa_id}`}>
            {a.tarefas?.titulo ?? 'Tarefa'}
          </Link>
          {a.estado === 'rodando' ? (
            <button className="btn-secondary !py-1" onClick={() => pausar(a.id).then(avisarTimer)}>
              Pausar
            </button>
          ) : (
            <button className="btn-primary !py-1" onClick={() => retomar(a.id, usuario.id).then(avisarTimer)}>
              Retomar
            </button>
          )}
          <button className="btn-danger !py-1" onClick={() => setParando(a)}>
            Parar
          </button>
        </div>
      ))}
      {parando && <PararModal ativo={parando} onClose={() => setParando(null)} />}
    </div>
  )
}
