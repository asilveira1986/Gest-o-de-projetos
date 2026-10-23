import { Link } from 'react-router-dom'
import { AvisoPrevisao } from '../components/AvisoPrevisao'
import { BarraOrcamento, Carregando, Erro, Indicador, Selo, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { carregarResumos } from '../lib/dados'
import { brl, fmtHoras, fmtPct } from '../lib/format'
import { STATUS_PROJETO } from '../lib/types'

export function Dashboard() {
  const { dados, erro, carregando } = useCarga(() => carregarResumos(), [])
  if (carregando) return <Carregando />
  const ativos = (dados ?? []).filter((r) => ['planejado', 'em_andamento', 'pausado'].includes(r.projeto.status))

  return (
    <div className="space-y-6">
      <div>
        <h1>Painel geral</h1>
        <p className="text-sm text-slate-500">{ativos.length} projeto(s) ativo(s)</p>
      </div>
      {ativos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo="Orçamento total" valor={brl(ativos.reduce((s, r) => s + r.projeto.orcamento, 0))} />
          <Indicador rotulo="Gasto total" valor={brl(ativos.reduce((s, r) => s + r.custo, 0))} />
          <Indicador rotulo="Margem" valor={brl(ativos.reduce((s, r) => s + r.margem, 0))} cor={ativos.reduce((s, r) => s + r.margem, 0) < 0 ? '!text-red-600' : '!text-brand-600'} />
          <Indicador rotulo="Tarefas atrasadas" valor={String(ativos.reduce((s, r) => s + r.atrasadas, 0))} cor={ativos.some((r) => r.atrasadas) ? '!text-red-600' : ''} />
        </div>
      )}
      <Erro msg={erro} />
      {!ativos.length && <Vazio>Nenhum projeto ativo. <Link className="text-brand-700 underline" to="/projetos">Crie o primeiro</Link>.</Vazio>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ativos.map((r) => (
          <Link key={r.projeto.id} to={`/projetos/${r.projeto.id}`} className="card block space-y-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-ink-900/5">
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
            <AvisoPrevisao previsao={r.previsao} />
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
