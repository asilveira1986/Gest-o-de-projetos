import { Link } from 'react-router-dom'
import { BarraOrcamento, Carregando, Erro, Selo, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { carregarResumos } from '../lib/dados'
import { brl, fmtHoras, fmtPct } from '../lib/format'
import { STATUS_PROJETO } from '../lib/types'

export function Dashboard() {
  const { dados, erro, carregando } = useCarga(() => carregarResumos(), [])
  if (carregando) return <Carregando />
  const ativos = (dados ?? []).filter((r) => ['planejado', 'em_andamento', 'pausado'].includes(r.projeto.status))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Painel geral</h1>
      <Erro msg={erro} />
      {!ativos.length && <Vazio>Nenhum projeto ativo. <Link className="text-blue-700 underline" to="/projetos">Crie o primeiro</Link>.</Vazio>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ativos.map((r) => (
          <Link key={r.projeto.id} to={`/projetos/${r.projeto.id}`} className="card block space-y-3 hover:border-blue-300">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.projeto.nome}</p>
                <p className="text-xs text-slate-500">{r.projeto.clientes?.nome ?? 'Sem cliente'}</p>
              </div>
              <Selo cor="blue">{STATUS_PROJETO[r.projeto.status]}</Selo>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>{brl(r.custo)} de {brl(r.projeto.orcamento)}</span>
                <span className={r.alerta === 'vermelho' ? 'font-semibold text-red-600' : r.alerta === 'amarelo' ? 'font-semibold text-amber-600' : ''}>
                  {fmtPct(r.pct)}
                </span>
              </div>
              <BarraOrcamento pct={r.pct} alerta={r.alerta} />
              {r.alerta !== 'ok' && (
                <p className={`mt-1 text-xs ${r.alerta === 'vermelho' ? 'text-red-600' : 'text-amber-600'}`}>
                  {r.alerta === 'vermelho' ? 'Orçamento estourado' : 'Atenção: acima de 80% do orçamento'}
                </p>
              )}
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>{fmtHoras(r.totalHoras)} / {fmtHoras(r.horasEstimadas)} est.</span>
              <span>Progresso {Math.round(r.progresso)}%</span>
              {r.atrasadas > 0 && <span className="font-medium text-red-600">{r.atrasadas} atrasada(s)</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
