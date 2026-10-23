import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CustoForm } from '../components/CustoForm'
import { HorasForm } from '../components/HorasForm'
import { PararModal } from '../components/PararModal'
import { avisarTimer, useAtivos } from '../components/TimerBar'
import { Carregando, Erro, Modal, Selo, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { useAuth } from '../lib/auth'
import { brl, fmtData, fmtHora, fmtHoras, fmtRelogio } from '../lib/format'
import { enviarArquivo, ok, supabase, urlAssinada } from '../lib/supabase'
import { iniciar, pausar, retomar, segundos } from '../lib/timer'
import { PRIORIDADE, STATUS_TAREFA, type Anexo, type Cliente, type Comentario, type Custo, type LancamentoHoras, type Intervalo, type Projeto, type StatusTarefa, type Subtarefa, type Tarefa, type Usuario } from '../lib/types'
import { TarefaForm } from './Projeto'

export function TarefaPage() {
  const { id = '' } = useParams()
  const { usuario } = useAuth()
  const ativos = useAtivos()
  const [editar, setEditar] = useState(false)
  const [lancarHora, setLancarHora] = useState(false)
  const [lancarCusto, setLancarCusto] = useState(false)
  const [parando, setParando] = useState(false)
  const [erroTimer, setErroTimer] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [novaSub, setNovaSub] = useState('')

  const { dados, erro, carregando, recarregar } = useCarga(async () => {
    const [t, s, h, c, co, a, u] = await Promise.all([
      supabase.from('tarefas').select('*, projetos(*, clientes(*))').eq('id', id).single(),
      supabase.from('subtarefas').select('*').eq('tarefa_id', id).order('titulo'),
      supabase.from('lancamentos_horas').select('*, intervalos_tempo(*), usuarios(id,nome)').eq('tarefa_id', id).order('data', { ascending: false }),
      supabase.from('custos').select('*').eq('tarefa_id', id).order('data', { ascending: false }),
      supabase.from('comentarios').select('*, usuarios(nome)').eq('tarefa_id', id).order('data'),
      supabase.from('anexos').select('*').eq('tarefa_id', id),
      supabase.from('usuarios').select('*').order('nome'),
    ])
    return {
      tarefa: ok(t) as Tarefa & { projetos: Projeto & { clientes: Cliente | null } },
      subs: ok(s) as Subtarefa[], horas: ok(h) as unknown as (LancamentoHoras & { intervalos_tempo: Intervalo[] })[],
      custos: ok(c) as Custo[], comentarios: ok(co) as Comentario[], anexos: ok(a) as Anexo[], usuarios: ok(u) as Usuario[],
    }
  }, [id])

  if (carregando && !dados) return <Carregando />
  if (!dados || !usuario) return <Erro msg={erro ?? 'Tarefa não encontrada.'} />
  const { tarefa: t, subs, horas, custos, comentarios, anexos, usuarios } = dados
  const meu = ativos.find((a) => a.tarefa_id === id)
  const total = horas.reduce((s, h) => s + Number(h.horas), 0)

  const acao = (fn: () => Promise<unknown>) => async () => {
    setErroTimer(null)
    try { await fn(); avisarTimer(); void recarregar() } catch (e) { setErroTimer((e as Error).message) }
  }

  async function mudarStatus(status: StatusTarefa) { ok(await supabase.from('tarefas').update({ status }).eq('id', id)); void recarregar() }
  async function alternarSub(s: Subtarefa) { ok(await supabase.from('subtarefas').update({ concluida: !s.concluida }).eq('id', s.id)); void recarregar() }
  async function addSub(e: React.FormEvent) {
    e.preventDefault(); if (!novaSub.trim()) return
    ok(await supabase.from('subtarefas').insert({ tarefa_id: id, titulo: novaSub.trim() })); setNovaSub(''); void recarregar()
  }
  async function delSub(s: Subtarefa) { ok(await supabase.from('subtarefas').delete().eq('id', s.id)); void recarregar() }
  async function addComentario(e: React.FormEvent) {
    e.preventDefault(); if (!comentario.trim()) return
    ok(await supabase.from('comentarios').insert({ tarefa_id: id, usuario_id: usuario!.id, texto: comentario.trim() })); setComentario(''); void recarregar()
  }
  async function anexar(f: File | undefined) {
    if (!f) return
    const caminho = await enviarArquivo('anexos', f, id)
    ok(await supabase.from('anexos').insert({ tarefa_id: id, nome: f.name, caminho, usuario_id: usuario!.id })); void recarregar()
  }
  async function abrirAnexo(a: Anexo) { const u = await urlAssinada('anexos', a.caminho); if (u) window.open(u, '_blank') }
  async function excluirHora(h: LancamentoHoras) {
    if (!confirm('Excluir este lançamento?')) return
    ok(await supabase.from('lancamentos_horas').delete().eq('id', h.id)); void recarregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to={`/projetos/${t.projeto_id}`} className="text-xs text-brand-700">← {t.projetos.nome}</Link>
          <h1 className="text-xl font-semibold">{t.titulo}</h1>
          <p className="text-sm text-slate-500">
            {PRIORIDADE[t.prioridade]} · prazo {fmtData(t.prazo)} · {usuarios.find((u) => u.id === t.responsavel_id)?.nome ?? 'sem responsável'} · estimativa {fmtHoras(t.horas_estimadas)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input !w-auto" value={t.status} onChange={(e) => mudarStatus(e.target.value as StatusTarefa)}>
            {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-secondary" onClick={() => setEditar(true)}>Editar</button>
        </div>
      </div>
      {t.descricao && <p className="card whitespace-pre-wrap text-sm">{t.descricao}</p>}

      {/* Cronômetro */}
      <div className="card flex flex-wrap items-center gap-3">
        <span className="font-mono text-2xl font-semibold">{fmtRelogio(meu ? segundos(meu) : 0)}</span>
        {!meu && <button className="btn-primary" onClick={acao(() => iniciar(t, usuario, t.projetos))}>▶ Iniciar</button>}
        {meu?.estado === 'rodando' && <button className="btn-secondary" onClick={acao(() => pausar(meu.id))}>⏸ Pausar</button>}
        {meu?.estado === 'pausado' && <button className="btn-primary" onClick={acao(() => retomar(meu.id, usuario.id))}>▶ Retomar</button>}
        {meu && <button className="btn-danger" onClick={() => setParando(true)}>■ Parar</button>}
        <button className="btn-secondary ml-auto" onClick={() => setLancarHora(true)}>+ Horas manuais</button>
        <div className="w-full"><Erro msg={erroTimer} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Checklist */}
        <div className="card space-y-2">
          <h2 className="font-medium">Checklist</h2>
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.concluida} onChange={() => alternarSub(s)} />
              <span className={s.concluida ? 'flex-1 text-slate-400 line-through' : 'flex-1'}>{s.titulo}</span>
              <button className="text-slate-400 hover:text-red-600" onClick={() => delSub(s)}>×</button>
            </div>
          ))}
          <form onSubmit={addSub} className="flex gap-2"><input className="input" placeholder="Nova subtarefa" value={novaSub} onChange={(e) => setNovaSub(e.target.value)} /><button className="btn-secondary">Adicionar</button></form>
        </div>

        {/* Anexos */}
        <div className="card space-y-2">
          <h2 className="font-medium">Anexos</h2>
          {!anexos.length && <p className="text-sm text-slate-500">Nenhum anexo.</p>}
          {anexos.map((a) => <button key={a.id} className="block text-sm text-brand-700 hover:underline" onClick={() => abrirAnexo(a)}>📎 {a.nome}</button>)}
          <input type="file" className="text-sm" onChange={(e) => { void anexar(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>

      {/* Horas */}
      <div className="card space-y-2">
        <h2 className="font-medium">Horas ({fmtHoras(total)})</h2>
        {!horas.length ? <Vazio>Sem lançamentos.</Vazio> : horas.map((h) => (
          <div key={h.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{fmtData(h.data)}</strong><span>{h.usuarios?.nome}</span><span>{fmtHoras(h.horas)}</span>
              <Selo cor={h.origem === 'cronometro' ? 'blue' : 'slate'}>{h.origem}</Selo>
              {h.estado !== 'finalizado' && <Selo cor="amber">{h.estado}</Selo>}
              {(h.usuario_id === usuario.id || usuario.perfil === 'admin') && h.estado === 'finalizado' &&
                <button className="ml-auto text-red-600" onClick={() => excluirHora(h)}>excluir</button>}
            </div>
            {h.descricao && <p className="text-slate-600">{h.descricao}</p>}
            {h.intervalos_tempo?.length > 0 && (
              <p className="text-xs text-slate-500">Sessão: {[...h.intervalos_tempo].sort((a, b) => a.inicio.localeCompare(b.inicio))
                .map((i) => `${fmtHora(i.inicio)}–${i.fim ? fmtHora(i.fim) : 'agora'}`).join(' · ')}</p>
            )}
          </div>
        ))}
      </div>

      {/* Custos vinculados */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between"><h2 className="font-medium">Custos vinculados</h2><button className="btn-secondary" onClick={() => setLancarCusto(true)}>+ Custo</button></div>
        {!custos.length ? <p className="text-sm text-slate-500">Nenhum custo vinculado.</p> : custos.map((c) => (
          <div key={c.id} className="flex justify-between text-sm"><span>{fmtData(c.data)} · {c.descricao} <Selo>{c.categoria}</Selo></span><strong>{brl(c.valor)}</strong></div>
        ))}
      </div>

      {/* Comentários */}
      <div className="card space-y-2">
        <h2 className="font-medium">Comentários</h2>
        {comentarios.map((c) => (
          <div key={c.id} className="text-sm"><span className="font-medium">{c.usuarios?.nome}</span> <span className="text-xs text-slate-500">{fmtData(c.data)} {fmtHora(c.data)}</span><p className="whitespace-pre-wrap">{c.texto}</p></div>
        ))}
        <form onSubmit={addComentario} className="flex gap-2"><input className="input" placeholder="Escreva um comentário" value={comentario} onChange={(e) => setComentario(e.target.value)} /><button className="btn-secondary">Enviar</button></form>
      </div>

      {editar && <Modal titulo="Editar tarefa" onClose={() => setEditar(false)}><TarefaForm projetoId={t.projeto_id} tarefa={t} usuarios={usuarios} onSalvo={() => { setEditar(false); void recarregar() }} /></Modal>}
      {lancarHora && <Modal titulo="Lançar horas" onClose={() => setLancarHora(false)}><HorasForm tarefaId={id} onSalvo={() => { setLancarHora(false); void recarregar() }} /></Modal>}
      {lancarCusto && <Modal titulo="Lançar custo" onClose={() => setLancarCusto(false)}><CustoForm projetoId={t.projeto_id} tarefaId={id} onSalvo={() => { setLancarCusto(false); void recarregar() }} /></Modal>}
      {parando && meu && <PararModal ativo={meu} onClose={() => setParando(false)} onSalvo={() => void recarregar()} />}
    </div>
  )
}
