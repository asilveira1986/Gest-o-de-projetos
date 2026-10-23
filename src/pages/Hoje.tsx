import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, Erro, Indicador, Selo } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { useAuth } from '../lib/auth'
import { diasEntre, inicioSemana, somarDias, statusFatura } from '../lib/calc'
import { brl, fmtData, fmtHoras, hoje } from '../lib/format'
import { ok, supabase } from '../lib/supabase'
import type { Fatura, Tarefa } from '../lib/types'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const CHAVE_META = 'meta-horas-dia'

function lerMeta() {
  try { const v = Number(localStorage.getItem(CHAVE_META)); return v > 0 ? v : 8 } catch { return 8 }
}

type TarefaProj = Tarefa & { projetos: { nome: string } | null }
type FaturaCli = Fatura & { clientes: { nome: string } | null }

export function Hoje() {
  const { usuario } = useAuth()
  const hoje_ = hoje()
  const seg = inicioSemana(hoje_)
  const dom = somarDias(seg, 6)
  const [meta, setMeta] = useState(lerMeta)

  const { dados, erro, carregando } = useCarga(async () => {
    const limite = somarDias(hoje_, 7)
    const [h, t, f] = await Promise.all([
      supabase.from('lancamentos_horas').select('data,horas,valor_hora_aplicado').eq('usuario_id', usuario?.id ?? '').gte('data', seg).lte('data', dom),
      supabase.from('tarefas').select('*, projetos!inner(nome,arquivado)').neq('status', 'concluida').not('prazo', 'is', null).lte('prazo', limite).eq('projetos.arquivado', false).order('prazo'),
      usuario?.perfil === 'admin'
        ? supabase.from('faturas').select('*, clientes(nome)').is('pago_em', null).lte('vencimento', limite).order('vencimento')
        : Promise.resolve({ data: [], error: null }),
    ])
    return {
      horas: ok(h) as { data: string; horas: number; valor_hora_aplicado: number }[],
      tarefas: ok(t) as unknown as TarefaProj[],
      faturas: ok(f as never) as FaturaCli[],
    }
  }, [usuario?.id])

  if (carregando && !dados) return <Carregando />

  const horas = dados?.horas ?? []
  const porDia = DIAS.map((_, i) => {
    const d = somarDias(seg, i)
    return { d, horas: horas.filter((h) => h.data === d).reduce((s, h) => s + Number(h.horas), 0) }
  })
  const horasHoje = porDia.find((x) => x.d === hoje_)?.horas ?? 0
  const horasSemana = porDia.reduce((s, x) => s + x.horas, 0)
  const custoSemana = horas.reduce((s, h) => s + h.horas * h.valor_hora_aplicado, 0)
  const maxDia = Math.max(meta, ...porDia.map((x) => x.horas))
  const pctMeta = Math.min(100, (horasHoje / meta) * 100)

  const atrasadas = (dados?.tarefas ?? []).filter((t) => t.prazo! < hoje_)
  const venceHoje = (dados?.tarefas ?? []).filter((t) => t.prazo === hoje_)
  const proximas = (dados?.tarefas ?? []).filter((t) => t.prazo! > hoje_)

  function mudarMeta(v: string) {
    const n = Number(v.replace(',', '.'))
    if (n > 0 && n <= 24) { setMeta(n); try { localStorage.setItem(CHAVE_META, String(n)) } catch { /* sem storage: vale só nesta sessão */ } }
  }

  const Lista = ({ titulo, itens, cor }: { titulo: string; itens: TarefaProj[]; cor: 'red' | 'amber' | 'slate' }) =>
    itens.length ? (
      <div className="card space-y-2">
        <h2 className="flex items-center gap-2 font-medium">{titulo} <Selo cor={cor}>{itens.length}</Selo></h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {itens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2">
              <Link to={`/tarefas/${t.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-700">{t.titulo}<span className="ml-2 font-normal text-slate-500">{t.projetos?.nome}</span></Link>
              <span className={`shrink-0 text-xs ${cor === 'red' ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                {fmtData(t.prazo)}{t.prazo! < hoje_ && ` · ${diasEntre(t.prazo!, hoje_)}d de atraso`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div className="space-y-6">
      <div><h1>Olá{usuario ? `, ${usuario.nome.split(' ')[0]}` : ''}</h1><p className="text-sm text-slate-500">{fmtData(hoje_)} · o que importa hoje e nesta semana.</p></div>
      <Erro msg={erro} />

      <div className="card space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Horas de hoje</p>
            <p className="text-3xl font-bold text-ink-900">{fmtHoras(horasHoje)} <span className="text-base font-medium text-slate-500">de {fmtHoras(meta)}</span></p></div>
          <label className="flex items-center gap-2 text-xs text-slate-500">Meta diária (h)
            <input className="input !w-16 !py-1" inputMode="decimal" defaultValue={String(meta).replace('.', ',')} onBlur={(e) => mudarMeta(e.target.value)} /></label>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600" style={{ width: `${pctMeta}%` }} />
        </div>
        <p className="text-xs text-slate-500">{horasHoje >= meta ? 'Meta do dia batida. 🎯' : `Faltam ${fmtHoras(meta - horasHoje)} para a meta.`}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Horas na semana" valor={fmtHoras(horasSemana)} sub={`Meta: ${fmtHoras(meta * 5)} (seg–sex)`} />
        <Indicador rotulo="Custo da semana" valor={brl(custoSemana)} sub="Mão de obra" />
        <Indicador rotulo="Tarefas atrasadas" valor={String(atrasadas.length)} cor={atrasadas.length ? '!text-red-600' : ''} />
        <Indicador rotulo="Vencem hoje" valor={String(venceHoje.length)} cor={venceHoje.length ? '!text-amber-600' : ''} />
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium">Semana ({fmtData(seg)} – {fmtData(dom)})</h2>
        <div className="flex h-36 items-end gap-2">
          {porDia.map((x, i) => (
            <div key={x.d} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] text-slate-500">{x.horas > 0 ? x.horas.toFixed(1).replace('.', ',') : ''}</span>
              <div className={`w-full rounded-t-md ${x.d === hoje_ ? 'bg-brand-500' : x.horas >= meta ? 'bg-brand-300' : 'bg-ink-100'}`}
                style={{ height: `${Math.max(x.horas > 0 ? 4 : 2, (x.horas / maxDia) * 100)}%` }} />
              <span className={`text-xs ${x.d === hoje_ ? 'font-bold text-brand-700' : 'text-slate-500'}`}>{DIAS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Lista titulo="Atrasadas" itens={atrasadas} cor="red" />
        <Lista titulo="Vencem hoje" itens={venceHoje} cor="amber" />
        <Lista titulo="Próximos 7 dias" itens={proximas} cor="slate" />
        {(dados?.faturas.length ?? 0) > 0 && (
          <div className="card space-y-2">
            <h2 className="font-medium">Faturas a receber (até 7 dias)</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {dados!.faturas.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2">
                  <span>{f.clientes?.nome} <span className="text-slate-500">· vence {fmtData(f.vencimento)}</span></span>
                  <span className="flex items-center gap-2"><strong>{brl(f.valor)}</strong>{statusFatura(f, hoje_) === 'vencida' && <Selo cor="red">vencida</Selo>}</span>
                </li>
              ))}
            </ul>
            <Link to="/faturamento" className="text-xs font-medium text-brand-700">Ir para Faturamento →</Link>
          </div>
        )}
      </div>
      {dados && !atrasadas.length && !venceHoje.length && !proximas.length && (
        <p className="text-center text-sm text-slate-500">Nenhuma tarefa com prazo nos próximos 7 dias. 🎉</p>
      )}
    </div>
  )
}
