import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Carregando, Erro } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { useAuth } from '../lib/auth'
import { gradeDoMes, mesAnterior, NOMES_MES, proximoMes } from '../lib/calendario'
import { brl, fmtData, hoje } from '../lib/format'
import { ok, supabase } from '../lib/supabase'

type Tipo = 'projeto' | 'tarefa' | 'fatura'
interface Evento {
  id: string
  data: string
  tipo: Tipo
  titulo: string
  detalhe: string
  to: string
  estado: 'normal' | 'atrasado' | 'concluido'
}

const ROTULO: Record<Tipo, string> = { projeto: 'Projetos', tarefa: 'Tarefas', fatura: 'Faturas' }
const COR: Record<Tipo, string> = {
  projeto: 'bg-ink-700 text-white',
  tarefa: 'bg-brand-100 text-brand-800',
  fatura: 'bg-amber-100 text-amber-800',
}
const PONTO: Record<Tipo, string> = { projeto: 'bg-ink-700', tarefa: 'bg-brand-500', fatura: 'bg-amber-500' }
const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function Calendario() {
  const { usuario } = useAuth()
  const hoje_ = hoje()
  const [ano, setAno] = useState(Number(hoje_.slice(0, 4)))
  const [mes, setMes] = useState(Number(hoje_.slice(5, 7)))
  const [sel, setSel] = useState(hoje_)
  const [ver, setVer] = useState<Record<Tipo, boolean>>({ projeto: true, tarefa: true, fatura: true })
  const grade = useMemo(() => gradeDoMes(ano, mes), [ano, mes])
  const de = grade[0][0]
  const ate = grade[grade.length - 1][6]

  const { dados, erro, carregando } = useCarga(async () => {
    const [p, t, f] = await Promise.all([
      supabase.from('projetos').select('id,nome,prazo,status,clientes(nome)').eq('arquivado', false).gte('prazo', de).lte('prazo', ate),
      supabase.from('tarefas').select('id,titulo,prazo,status,projetos!inner(nome,arquivado)').eq('projetos.arquivado', false).gte('prazo', de).lte('prazo', ate),
      usuario?.perfil === 'admin'
        ? supabase.from('faturas').select('id,vencimento,valor,pago_em,clientes(nome)').gte('vencimento', de).lte('vencimento', ate)
        : Promise.resolve({ data: [], error: null }),
    ])
    const eventos: Evento[] = []
    for (const x of ok(p) as unknown as { id: string; nome: string; prazo: string; status: string; clientes: { nome: string } | null }[]) {
      const fim = ['concluido', 'cancelado'].includes(x.status)
      eventos.push({ id: `p${x.id}`, data: x.prazo, tipo: 'projeto', titulo: x.nome, detalhe: `Prazo do projeto${x.clientes ? ` · ${x.clientes.nome}` : ''}`,
        to: `/projetos/${x.id}`, estado: fim ? 'concluido' : x.prazo < hoje_ ? 'atrasado' : 'normal' })
    }
    for (const x of ok(t) as unknown as { id: string; titulo: string; prazo: string; status: string; projetos: { nome: string } }[]) {
      eventos.push({ id: `t${x.id}`, data: x.prazo, tipo: 'tarefa', titulo: x.titulo, detalhe: `Tarefa · ${x.projetos.nome}`,
        to: `/tarefas/${x.id}`, estado: x.status === 'concluida' ? 'concluido' : x.prazo < hoje_ ? 'atrasado' : 'normal' })
    }
    for (const x of ok(f as never) as { id: string; vencimento: string; valor: number; pago_em: string | null; clientes: { nome: string } | null }[]) {
      eventos.push({ id: `f${x.id}`, data: x.vencimento, tipo: 'fatura', titulo: `${x.clientes?.nome ?? 'Fatura'} — ${brl(x.valor)}`, detalhe: 'Vencimento de fatura',
        to: '/faturamento', estado: x.pago_em ? 'concluido' : x.vencimento < hoje_ ? 'atrasado' : 'normal' })
    }
    return eventos
  }, [de, ate, usuario?.perfil])

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>()
    ;(dados ?? []).filter((e) => ver[e.tipo]).forEach((e) => m.set(e.data, [...(m.get(e.data) ?? []), e]))
    return m
  }, [dados, ver])

  const irPara = (a: { ano: number; mes: number }) => { setAno(a.ano); setMes(a.mes) }
  const doDia = porDia.get(sel) ?? []
  const estilo = (e: Evento) => e.estado === 'atrasado' ? 'bg-red-100 text-red-700' : e.estado === 'concluido' ? 'bg-ink-100 text-slate-400 line-through' : COR[e.tipo]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1>Calendário</h1><p className="text-sm text-slate-500">Prazos de projetos e tarefas, e vencimento de faturas.</p></div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => irPara(mesAnterior(ano, mes))} aria-label="Mês anterior">‹</button>
          <span className="w-40 text-center font-semibold capitalize">{NOMES_MES[mes - 1]} {ano}</span>
          <button className="btn-secondary" onClick={() => irPara(proximoMes(ano, mes))} aria-label="Próximo mês">›</button>
          <button className="btn-secondary" onClick={() => { irPara({ ano: Number(hoje_.slice(0, 4)), mes: Number(hoje_.slice(5, 7)) }); setSel(hoje_) }}>Hoje</button>
        </div>
      </div>
      <Erro msg={erro} />
      <div className="flex flex-wrap gap-4 text-sm">
        {(Object.keys(ROTULO) as Tipo[]).filter((t) => t !== 'fatura' || usuario?.perfil === 'admin').map((t) => (
          <label key={t} className="flex items-center gap-2"><input type="checkbox" checked={ver[t]} onChange={(e) => setVer({ ...ver, [t]: e.target.checked })} />
            <span className={`h-2.5 w-2.5 rounded-full ${PONTO[t]}`} />{ROTULO[t]}</label>
        ))}
        <span className="flex items-center gap-2 text-red-600"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Atrasado</span>
      </div>

      {carregando && !dados ? <Carregando /> : (
        <div className="card overflow-hidden !p-0">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-ink-50 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {SEMANA.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {grade.map((semana, i) => (
            <div key={i} className="grid grid-cols-7">
              {semana.map((d) => {
                const evs = porDia.get(d) ?? []
                const doMes = d.slice(0, 7) === `${ano}-${String(mes).padStart(2, '0')}`
                return (
                  <button key={d} onClick={() => setSel(d)}
                    className={`min-h-[4.5rem] border-b border-r border-slate-100 p-1 text-left align-top transition sm:min-h-[6.5rem] sm:p-1.5 ${doMes ? 'bg-white' : 'bg-ink-50/70'} ${sel === d ? 'ring-2 ring-inset ring-brand-500' : 'hover:bg-brand-50/50'}`}>
                    <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs ${d === hoje_ ? 'bg-brand-600 font-bold text-white' : doMes ? 'text-ink-800' : 'text-slate-400'}`}>{Number(d.slice(8))}</span>
                    {/* celular: pontos; telas maiores: etiquetas */}
                    <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">{evs.slice(0, 6).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.estado === 'atrasado' ? 'bg-red-500' : PONTO[e.tipo]}`} />)}</div>
                    <div className="mt-1 hidden space-y-0.5 sm:block">
                      {evs.slice(0, 3).map((e) => <div key={e.id} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${estilo(e)}`}>{e.titulo}</div>)}
                      {evs.length > 3 && <div className="px-1 text-[11px] text-slate-500">+{evs.length - 3} mais</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-2">
        <h2 className="font-medium">{fmtData(sel)}{sel === hoje_ && ' · hoje'}</h2>
        {!doDia.length ? <p className="text-sm text-slate-500">Nada com prazo neste dia.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {doDia.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <Link to={e.to} className="flex min-w-0 items-center gap-2 hover:text-brand-700">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${e.estado === 'atrasado' ? 'bg-red-500' : PONTO[e.tipo]}`} />
                  <span className={`truncate font-medium ${e.estado === 'concluido' ? 'text-slate-400 line-through' : ''}`}>{e.titulo}</span>
                </Link>
                <span className="shrink-0 text-xs text-slate-500">{e.detalhe}{e.estado === 'atrasado' && <span className="font-medium text-red-600"> · atrasado</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
