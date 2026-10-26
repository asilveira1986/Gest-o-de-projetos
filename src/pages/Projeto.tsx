import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CustoForm } from '../components/CustoForm'
import { HorasForm } from '../components/HorasForm'
import { SalvarModelo } from '../components/Modelos'
import { Recorrentes } from '../components/Recorrentes'
import { AvisoPrevisao } from '../components/AvisoPrevisao'
import { BarraOrcamento, Campo, Carregando, Erro, Indicador, Modal, Selo, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { useAuth } from '../lib/auth'
import { montarResumo, type LancComTarefa } from '../lib/dados'
import { brl, fmtData, fmtHoras, fmtPct, hoje } from '../lib/format'
import { custoMaoDeObra, receitaPorHora, tarefaAtrasada } from '../lib/calc'
import { ok, supabase, urlAssinada } from '../lib/supabase'
import { PRIORIDADE, STATUS_TAREFA, type Custo, type Projeto, type StatusTarefa, type Tarefa, type Usuario } from '../lib/types'
import { ABAS_PROJETO, type Aba } from '../lib/abas'
import { ProjetoForm } from './Projetos'


export function ProjetoPage() {
  const { id = '', aba: abaParam } = useParams()
  const nav = useNavigate()
  const { usuario } = useAuth()
  const aba: Aba = ABAS_PROJETO.some(([k]) => k === abaParam) ? (abaParam as Aba) : 'resumo'
  const [editar, setEditar] = useState(false)
  const [modelo, setModelo] = useState(false)
  const { dados, erro, carregando, recarregar } = useCarga(async () => {
    const [p, t, h, c, m, u] = await Promise.all([
      supabase.from('projetos').select('*, clientes(*)').eq('id', id).single(),
      supabase.from('tarefas').select('*').eq('projeto_id', id).order('ordem'),
      supabase.from('lancamentos_horas').select('*, tarefas!inner(id,titulo,projeto_id), usuarios(id,nome)').eq('tarefas.projeto_id', id).order('data', { ascending: false }),
      supabase.from('custos').select('*').eq('projeto_id', id).order('data', { ascending: false }),
      supabase.from('projeto_membros').select('usuario_id').eq('projeto_id', id),
      supabase.from('usuarios').select('*').order('nome'),
    ])
    const projeto = ok(p) as Projeto
    return {
      resumo: montarResumo(projeto, ok(t) as Tarefa[], ok(h) as unknown as LancComTarefa[], ok(c) as Custo[]),
      membros: (ok(m) as { usuario_id: string }[]).map((x) => x.usuario_id),
      usuarios: ok(u) as Usuario[],
    }
  }, [id])

  if (carregando && !dados) return <Carregando />
  if (!dados) return <Erro msg={erro ?? 'Projeto não encontrado.'} />
  const { resumo: r, membros, usuarios } = dados
  const p = r.projeto

  async function alternarArquivo() {
    ok(await supabase.from('projetos').update({ arquivado: !p.arquivado }).eq('id', id))
    void recarregar()
  }
  async function excluir() {
    if (!confirm('Excluir o projeto? (Só é possível se não tiver lançamentos.)')) return
    try { ok(await supabase.from('projetos').delete().eq('id', id)); nav('/projetos') }
    catch (e) { alert((e as Error).message + ' Use "Arquivar".') }
  }
  async function alternarMembro(uid: string) {
    if (membros.includes(uid)) ok(await supabase.from('projeto_membros').delete().eq('projeto_id', id).eq('usuario_id', uid))
    else ok(await supabase.from('projeto_membros').insert({ projeto_id: id, usuario_id: uid }))
    void recarregar()
  }

  const bloqueado = ['concluido', 'cancelado'].includes(p.status) && usuario?.perfil !== 'admin'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/projetos" className="text-xs text-brand-700">← Projetos</Link>
          <h1 className="text-xl font-semibold">{p.nome} {p.arquivado && <Selo>arquivado</Selo>}</h1>
          <p className="text-sm text-slate-500">{p.clientes?.nome ?? 'Sem cliente'} · prazo {fmtData(p.prazo)}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setEditar(true)}>Editar</button>
          {usuario?.perfil === 'admin' && <button className="btn-secondary" onClick={() => setModelo(true)}>Salvar como modelo</button>}
          <button className="btn-secondary" onClick={alternarArquivo}>{p.arquivado ? 'Desarquivar' : 'Arquivar'}</button>
          {usuario?.perfil === 'admin' && <button className="btn-secondary text-red-600" onClick={excluir}>Excluir</button>}
        </div>
      </div>
      {bloqueado && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Projeto {p.status}: novos lançamentos bloqueados.</p>}

      {/* No desktop as abas ficam no menu lateral; aqui só no celular */}
      <div className="flex gap-1 border-b border-slate-200 lg:hidden">
        {ABAS_PROJETO.map(([k, nome]) => (
          <Link key={k} to={`/projetos/${id}/${k}`}
            className={`px-4 py-2 text-sm ${aba === k ? 'border-b-2 border-brand-600 font-semibold text-brand-700' : 'text-slate-600'}`}>{nome}</Link>
        ))}
      </div>

      {aba === 'resumo' && <Resumo r={r} usuarios={usuarios} membros={membros} onMembro={alternarMembro} />}
      {aba === 'tarefas' && <Tarefas projetoId={id} tarefas={r.tarefas} usuarios={usuarios} onMudou={recarregar} />}
      {aba === 'custos' && <Custos projetoId={id} custos={r.custos} onMudou={recarregar} />}
      {aba === 'horas' && <Horas horas={r.horas} fixo={p.tipo_cobranca === 'fixo'} onMudou={recarregar} />}

      {modelo && <SalvarModelo projetoId={id} nomeSugerido={`Modelo — ${p.nome}`} onClose={() => setModelo(false)} />}
      {editar && <Modal titulo="Editar projeto" onClose={() => setEditar(false)}><ProjetoForm projeto={p} onSalvo={() => { setEditar(false); void recarregar() }} /></Modal>}
    </div>
  )
}

function Resumo({ r, usuarios, membros, onMembro }: { r: ReturnType<typeof montarResumo>; usuarios: Usuario[]; membros: string[]; onMembro: (id: string) => void }) {
  const serie = useMemo(() => {
    const porDia = new Map<string, number>()
    r.horas.forEach((l) => porDia.set(l.data, (porDia.get(l.data) ?? 0) + l.horas * l.valor_hora_aplicado))
    r.custos.filter((c) => c.situacao === 'realizado').forEach((c) => porDia.set(c.data, (porDia.get(c.data) ?? 0) + c.valor))
    let acc = 0
    return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ data: fmtData(d), gasto: Math.round((acc += v) * 100) / 100 }))
  }, [r])
  const cor = r.alerta === 'vermelho' ? 'text-red-600' : r.alerta === 'amarelo' ? 'text-amber-600' : ''
  const maoObra = custoMaoDeObra(r.horas)
  const hoje_ = hoje()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Orçamento" valor={brl(r.projeto.orcamento)} />
        <Indicador rotulo="Gasto" valor={brl(r.custo)} sub={`Mão de obra ${brl(maoObra)} · custos ${brl(r.custo - maoObra)}`} />
        <Indicador rotulo="Saldo" valor={brl(r.saldo)} cor={r.saldo < 0 ? 'text-red-600' : ''} sub={`Projetado: ${brl(r.projetado)}`} />
        <Indicador rotulo="% consumido" valor={fmtPct(r.pct)} cor={cor} />
        <Indicador rotulo="Horas" valor={fmtHoras(r.totalHoras)} sub={`Estimadas: ${fmtHoras(r.horasEstimadas)}`} />
        <Indicador rotulo="Progresso" valor={`${Math.round(r.progresso)}%`} sub={`${r.tarefas.filter((t) => t.status === 'concluida').length}/${r.tarefas.length} tarefas`} />
        <Indicador rotulo="Receita" valor={brl(r.receita)} sub={r.projeto.tipo_cobranca === 'fixo' ? 'Valor fixo' : 'Por hora'} />
        <Indicador rotulo="Margem" valor={brl(r.margem)} cor={r.margem < 0 ? 'text-red-600' : 'text-brand-600'} />
        <Indicador rotulo="Receita por hora" valor={brl(receitaPorHora(r.receita, r.totalHoras))} sub="Receita ÷ horas trabalhadas" />
      </div>
      <BarraOrcamento pct={r.pct} alerta={r.alerta} />
      <AvisoPrevisao previsao={r.previsao} />

      <div className="card">
        <h2 className="mb-2 font-medium">Gasto acumulado vs. orçamento</h2>
        {serie.length ? (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$ ${v}`} width={70} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                {r.projeto.orcamento > 0 && <ReferenceLine y={r.projeto.orcamento} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'Orçamento', fontSize: 11, fill: '#dc2626' }} />}
                <Line type="monotone" dataKey="gasto" name="Gasto acumulado" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Vazio>Sem lançamentos ainda.</Vazio>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-medium">Tarefas por status</h2>
          <ul className="space-y-1 text-sm">
            {(Object.keys(STATUS_TAREFA) as StatusTarefa[]).map((s) => (
              <li key={s} className="flex justify-between"><span>{STATUS_TAREFA[s]}</span><strong>{r.tarefas.filter((t) => t.status === s).length}</strong></li>
            ))}
            <li className="flex justify-between text-red-600"><span>Atrasadas</span><strong>{r.tarefas.filter((t) => tarefaAtrasada(t, hoje_)).length}</strong></li>
          </ul>
        </div>
        <div className="card">
          <h2 className="mb-2 font-medium">Membros</h2>
          <div className="space-y-1 text-sm">
            {usuarios.map((u) => (
              <label key={u.id} className="flex items-center gap-2">
                <input type="checkbox" checked={membros.includes(u.id)} onChange={() => onMembro(u.id)} /> {u.nome}
                {u.id === r.projeto.responsavel_id && <Selo cor="blue">responsável</Selo>}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────── Tarefas (Kanban / lista) ─────────────

function Tarefas({ projetoId, tarefas, usuarios, onMudou }: { projetoId: string; tarefas: Tarefa[]; usuarios: Usuario[]; onMudou: () => void }) {
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban')
  const [novo, setNovo] = useState(false)
  const [fResp, setFResp] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fPrio, setFPrio] = useState('')
  const [fPrazo, setFPrazo] = useState('')
  const hoje_ = hoje()

  const filtradas = tarefas.filter((t) =>
    (!fResp || t.responsavel_id === fResp) && (!fStatus || t.status === fStatus) && (!fPrio || t.prioridade === fPrio) &&
    (!fPrazo || (fPrazo === 'atrasadas' ? tarefaAtrasada(t, hoje_) : t.prazo && t.prazo <= fPrazo)),
  )
  const nomeDe = (id: string | null) => usuarios.find((u) => u.id === id)?.nome ?? '—'

  async function mover(id: string, status: StatusTarefa) {
    ok(await supabase.from('tarefas').update({ status, ordem: Date.now() % 2_000_000_000 }).eq('id', id))
    onMudou()
  }

  const Card = ({ t }: { t: Tarefa }) => (
    <div draggable onDragStart={(e) => e.dataTransfer.setData('id', t.id)} className="card cursor-grab space-y-1 !p-3">
      <Link to={`/tarefas/${t.id}`} className="text-sm font-medium hover:text-brand-700">{t.titulo}</Link>
      <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Selo cor={t.prioridade === 'alta' ? 'red' : t.prioridade === 'media' ? 'amber' : 'slate'}>{PRIORIDADE[t.prioridade]}</Selo>
        <span>{nomeDe(t.responsavel_id)}</span>
        {t.prazo && <span className={tarefaAtrasada(t, hoje_) ? 'font-medium text-red-600' : ''}>{fmtData(t.prazo)}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <select className="input !w-auto" value={fResp} onChange={(e) => setFResp(e.target.value)}>
          <option value="">Responsável: todos</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <select className="input !w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Status: todos</option>{Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input !w-auto" value={fPrio} onChange={(e) => setFPrio(e.target.value)}>
          <option value="">Prioridade: todas</option>{Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input !w-auto" value={fPrazo} onChange={(e) => setFPrazo(e.target.value)}>
          <option value="">Prazo: todos</option><option value="atrasadas">Atrasadas</option><option value={hoje_}>Vence até hoje</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={() => setVista(vista === 'kanban' ? 'lista' : 'kanban')}>{vista === 'kanban' ? 'Ver lista' : 'Ver Kanban'}</button>
          <button className="btn-primary" onClick={() => setNovo(true)}>+ Tarefa</button>
        </div>
      </div>

      {vista === 'kanban' ? (
        <div className="grid gap-3 md:grid-cols-4">
          {(Object.keys(STATUS_TAREFA) as StatusTarefa[]).map((s) => (
            <div key={s} className="min-h-[8rem] rounded-xl bg-ink-100/70 p-2.5"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('id'); if (id) void mover(id, s) }}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase text-slate-500">{STATUS_TAREFA[s]} ({filtradas.filter((t) => t.status === s).length})</p>
              <div className="space-y-2">{filtradas.filter((t) => t.status === s).map((t) => <Card key={t.id} t={t} />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full"><thead className="border-b bg-ink-50"><tr><th className="th">Tarefa</th><th className="th">Responsável</th><th className="th">Status</th><th className="th">Prioridade</th><th className="th">Prazo</th><th className="th">Estimativa</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{filtradas.map((t) => (
              <tr key={t.id}><td className="td"><Link className="text-brand-700 hover:underline" to={`/tarefas/${t.id}`}>{t.titulo}</Link></td><td className="td">{nomeDe(t.responsavel_id)}</td>
                <td className="td">{STATUS_TAREFA[t.status]}</td><td className="td">{PRIORIDADE[t.prioridade]}</td>
                <td className={`td ${tarefaAtrasada(t, hoje_) ? 'text-red-600' : ''}`}>{fmtData(t.prazo)}</td><td className="td">{fmtHoras(t.horas_estimadas)}</td></tr>))}
            </tbody></table>
        </div>
      )}
      {novo && <Modal titulo="Nova tarefa" onClose={() => setNovo(false)}><TarefaForm projetoId={projetoId} usuarios={usuarios} onSalvo={() => { setNovo(false); onMudou() }} /></Modal>}
    </div>
  )
}

export function TarefaForm({ projetoId, tarefa, usuarios, onSalvo }: { projetoId: string; tarefa?: Tarefa; usuarios: Usuario[]; onSalvo: () => void }) {
  const [f, setF] = useState({
    titulo: tarefa?.titulo ?? '', descricao: tarefa?.descricao ?? '', responsavel_id: tarefa?.responsavel_id ?? '',
    prioridade: tarefa?.prioridade ?? 'media', prazo: tarefa?.prazo ?? '', horas_estimadas: String(tarefa?.horas_estimadas ?? '').replace('.', ','),
  })
  const [erro, setErro] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const row = { titulo: f.titulo, descricao: f.descricao || null, responsavel_id: f.responsavel_id || null, prioridade: f.prioridade,
      prazo: f.prazo || null, horas_estimadas: f.horas_estimadas ? Number(f.horas_estimadas.replace(',', '.')) : 0 }
    try {
      if (tarefa) ok(await supabase.from('tarefas').update(row).eq('id', tarefa.id))
      else ok(await supabase.from('tarefas').insert({ ...row, projeto_id: projetoId, ordem: Date.now() % 2_000_000_000 }))
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }
  return (
    <form onSubmit={salvar} className="space-y-3">
      <Campo rotulo="Título"><input className="input" value={f.titulo} onChange={(e) => set('titulo', e.target.value)} required autoFocus /></Campo>
      <Campo rotulo="Descrição"><textarea className="input" rows={2} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Responsável"><select className="input" value={f.responsavel_id} onChange={(e) => set('responsavel_id', e.target.value)}><option value="">—</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Campo>
        <Campo rotulo="Prioridade"><select className="input" value={f.prioridade} onChange={(e) => set('prioridade', e.target.value)}>{Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo rotulo="Prazo"><input type="date" className="input" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} /></Campo>
        <Campo rotulo="Estimativa (h)"><input className="input" inputMode="decimal" value={f.horas_estimadas} onChange={(e) => set('horas_estimadas', e.target.value)} /></Campo>
      </div>
      <Erro msg={erro} />
      <button className="btn-primary w-full">Salvar</button>
    </form>
  )
}

// ───────────── Custos ─────────────

function Custos({ projetoId, custos, onMudou }: { projetoId: string; custos: Custo[]; onMudou: () => void }) {
  const [novo, setNovo] = useState(false)
  const [edit, setEdit] = useState<Custo | null>(null)
  const [cat, setCat] = useState('')
  const [sit, setSit] = useState('')
  const lista = custos.filter((c) => (!cat || c.categoria === cat) && (!sit || c.situacao === sit))
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    lista.forEach((c) => m.set(c.categoria, (m.get(c.categoria) ?? 0) + c.valor))
    return [...m.entries()]
  }, [lista])

  async function excluir(c: Custo) {
    if (!confirm('Excluir este custo?')) return
    ok(await supabase.from('custos').delete().eq('id', c.id)); onMudou()
  }
  async function verComprovante(c: Custo) {
    const u = c.comprovante_url && (await urlAssinada('comprovantes', c.comprovante_url))
    if (u) window.open(u, '_blank')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Categoria: todas</option>{[...new Set(custos.map((c) => c.categoria))].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input !w-auto" value={sit} onChange={(e) => setSit(e.target.value)}>
          <option value="">Situação: todas</option><option value="realizado">Realizado</option><option value="previsto">Previsto</option>
        </select>
        <button className="btn-primary ml-auto" onClick={() => setNovo(true)}>+ Custo</button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {porCategoria.map(([c, v]) => <Selo key={c}>{c}: {brl(v)}</Selo>)}
      </div>
      {!lista.length ? <Vazio>Nenhum custo.</Vazio> : (
        <div className="card overflow-x-auto p-0"><table className="w-full">
          <thead className="border-b bg-ink-50"><tr><th className="th">Data</th><th className="th">Descrição</th><th className="th">Categoria</th><th className="th">Valor</th><th className="th">Situação</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{lista.map((c) => (
            <tr key={c.id}><td className="td">{fmtData(c.data)}</td>
              <td className="td">{c.descricao}{c.fornecedor && <span className="text-xs text-slate-500"> · {c.fornecedor}</span>}{c.repassar_cliente && <> <Selo cor="blue">repasse</Selo></>}{c.recorrente_id && <> <Selo>recorrente</Selo></>}</td>
              <td className="td">{c.categoria}</td><td className="td">{brl(c.valor)}</td>
              <td className="td"><Selo cor={c.situacao === 'realizado' ? 'green' : 'amber'}>{c.situacao}</Selo></td>
              <td className="td whitespace-nowrap text-right">
                {c.comprovante_url && <button className="mr-2 text-brand-700" onClick={() => verComprovante(c)}>comprovante</button>}
                <button className="mr-2 text-brand-700" onClick={() => setEdit(c)}>editar</button>
                <button className="text-red-600" onClick={() => excluir(c)}>excluir</button></td></tr>))}
          </tbody></table></div>
      )}
      <Recorrentes projetoId={projetoId} onMudou={onMudou} />
      {novo && <Modal titulo="Novo custo" onClose={() => setNovo(false)}><CustoForm projetoId={projetoId} onSalvo={() => { setNovo(false); onMudou() }} /></Modal>}
      {edit && <Modal titulo="Editar custo" onClose={() => setEdit(null)}><CustoForm projetoId={projetoId} custo={edit} onSalvo={() => { setEdit(null); onMudou() }} /></Modal>}
    </div>
  )
}

// ───────────── Horas ─────────────

function Horas({ horas, fixo, onMudou }: { horas: LancComTarefa[]; fixo: boolean; onMudou: () => void }) {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [edit, setEdit] = useState<LancComTarefa | null>(null)
  const { usuario } = useAuth()
  const lista = horas.filter((h) => (!de || h.data >= de) && (!ate || h.data <= ate) && (!pessoa || h.usuario_id === pessoa))
  const pessoas = [...new Map(horas.map((h) => [h.usuario_id, h.usuarios?.nome ?? '—'])).entries()]
  const porPessoa = pessoas.map(([id, nome]) => [nome, lista.filter((h) => h.usuario_id === id).reduce((s, h) => s + h.horas, 0)] as const).filter(([, v]) => v > 0)
  const aFaturar = lista.filter((h) => !fixo && h.faturavel && !h.faturado_em && h.estado === 'finalizado')

  async function faturar() {
    if (!confirm(`Marcar ${aFaturar.length} lançamento(s) como faturados em ${fmtData(hoje())}?`)) return
    ok(await supabase.from('lancamentos_horas').update({ faturado_em: hoje() }).in('id', aFaturar.map((h) => h.id))); onMudou()
  }
  async function excluir(h: LancComTarefa) {
    if (!confirm('Excluir este lançamento?')) return
    ok(await supabase.from('lancamentos_horas').delete().eq('id', h.id)); onMudou()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="De"><input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} /></Campo>
        <Campo rotulo="Até"><input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>
        <select className="input !w-auto" value={pessoa} onChange={(e) => setPessoa(e.target.value)}><option value="">Todas as pessoas</option>{pessoas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        {aFaturar.length > 0 && <button className="btn-secondary ml-auto" onClick={faturar}>Marcar {aFaturar.length} como faturados</button>}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">{porPessoa.map(([n, v]) => <Selo key={n}>{n}: {fmtHoras(v)}</Selo>)}</div>
      {!lista.length ? <Vazio>Nenhum lançamento.</Vazio> : (
        <div className="card overflow-x-auto p-0"><table className="w-full">
          <thead className="border-b bg-ink-50"><tr><th className="th">Data</th><th className="th">Pessoa</th><th className="th">Tarefa</th><th className="th">Horas</th><th className="th">Custo</th><th className="th">Faturamento</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{lista.map((h) => (
            <tr key={h.id}><td className="td">{fmtData(h.data)}</td><td className="td">{h.usuarios?.nome}</td>
              <td className="td"><Link className="text-brand-700 hover:underline" to={`/tarefas/${h.tarefa_id}`}>{h.tarefas.titulo}</Link>{h.descricao && <span className="block text-xs text-slate-500">{h.descricao}</span>}</td>
              <td className="td">{fmtHoras(h.horas)}{h.estado !== 'finalizado' && <> <Selo cor="amber">{h.estado}</Selo></>}</td>
              <td className="td">{brl(h.horas * h.valor_hora_aplicado)}</td>
              <td className="td">{fixo ? <Selo>valor fixo</Selo> : !h.faturavel ? <Selo>não faturável</Selo> : h.faturado_em ? <Selo cor="green">faturado {fmtData(h.faturado_em)}</Selo> : <Selo cor="amber">a faturar</Selo>}</td>
              <td className="td whitespace-nowrap text-right">{(h.usuario_id === usuario?.id || usuario?.perfil === 'admin') && h.estado === 'finalizado' && <>
                <button className="mr-2 text-brand-700" onClick={() => setEdit(h)}>editar</button><button className="text-red-600" onClick={() => excluir(h)}>excluir</button></>}</td></tr>))}
          </tbody></table></div>
      )}
      {edit && <Modal titulo="Editar lançamento" onClose={() => setEdit(null)}><HorasForm lancamento={edit} onSalvo={() => { setEdit(null); onMudou() }} /></Modal>}
    </div>
  )
}
