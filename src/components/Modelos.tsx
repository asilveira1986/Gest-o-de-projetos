import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { hoje } from '../lib/format'
import { criarProjetoDeModelo, salvarComoModelo, type Modelo } from '../lib/modelos'
import { ok, supabase } from '../lib/supabase'
import type { Cliente } from '../lib/types'
import { Campo, Erro, Modal, Selo } from './ui'
import { useCarga } from './useAsync'

/** Lista de modelos: usar para criar projeto ou excluir. */
export function ModelosModal({ onClose }: { onClose: () => void }) {
  const [usar, setUsar] = useState<Modelo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const { dados, recarregar } = useCarga(async () => ok(await supabase.from('modelos_projeto').select('*').order('nome')) as Modelo[], [])

  async function excluir(m: Modelo) {
    if (!confirm(`Excluir o modelo "${m.nome}"? Projetos já criados com ele não são afetados.`)) return
    try { ok(await supabase.from('modelos_projeto').delete().eq('id', m.id)); void recarregar() } catch (e) { setErro((e as Error).message) }
  }

  if (usar) return <Modal titulo={`Novo projeto — ${usar.nome}`} onClose={onClose}><NovoDeModelo modelo={usar} onVoltar={() => setUsar(null)} /></Modal>

  return (
    <Modal titulo="Modelos de projeto" onClose={onClose}>
      <div className="space-y-3">
        <Erro msg={erro} />
        {!dados?.length ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
            Nenhum modelo ainda. Abra um projeto e use <strong>Salvar como modelo</strong>.
          </p>
        ) : dados.map((m) => (
          <div key={m.id} className="card !p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{m.nome}</p>
                {m.descricao && <p className="text-xs text-slate-500">{m.descricao}</p>}
                <p className="mt-1 flex flex-wrap gap-1 text-xs"><Selo>{m.dados.tarefas.length} tarefa(s)</Selo>
                  <Selo>{m.dados.tarefas.reduce((s, t) => s + t.subtarefas.length, 0)} item(ns) de checklist</Selo>
                  {m.dados.recorrentes.length > 0 && <Selo>{m.dados.recorrentes.length} custo(s) recorrente(s)</Selo>}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button className="btn-primary !py-1" onClick={() => setUsar(m)}>Usar</button>
                <button className="text-xs text-red-600" onClick={() => excluir(m)}>excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function NovoDeModelo({ modelo, onVoltar }: { modelo: Modelo; onVoltar: () => void }) {
  const nav = useNavigate()
  const { usuario } = useAuth()
  const { dados: clientes } = useCarga(async () => ok(await supabase.from('clientes').select('*').order('nome')) as Cliente[], [])
  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState('')
  const [inicio, setInicio] = useState(hoje())
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const id = await criarProjetoDeModelo(modelo, { nome, cliente_id: cliente || null, inicio, responsavel_id: usuario?.id ?? null })
      nav(`/projetos/${id}/tarefas`)
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }

  return (
    <form onSubmit={criar} className="space-y-3">
      <Campo rotulo="Nome do projeto"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></Campo>
      <Campo rotulo="Cliente (opcional)">
        <select className="input" value={cliente} onChange={(e) => setCliente(e.target.value)}><option value="">Sem cliente</option>{clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      </Campo>
      <Campo rotulo="Data de início"><input type="date" className="input" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></Campo>
      <p className="text-xs text-slate-500">Os prazos das tarefas e do projeto são recalculados a partir da data de início.</p>
      <Erro msg={erro} />
      <div className="flex gap-2"><button type="button" className="btn-secondary" onClick={onVoltar}>Voltar</button><button className="btn-primary flex-1" disabled={salvando}>Criar projeto</button></div>
    </form>
  )
}

/** Botão + modal "Salvar como modelo" da página do projeto. */
export function SalvarModelo({ projetoId, nomeSugerido, onClose }: { projetoId: string; nomeSugerido: string; onClose: () => void }) {
  const [nome, setNome] = useState(nomeSugerido)
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try { await salvarComoModelo(projetoId, nome.trim(), descricao.trim() || null); setFeito(true) } catch (e) { setErro((e as Error).message) }
  }

  return (
    <Modal titulo="Salvar como modelo" onClose={onClose}>
      {feito ? (
        <div className="space-y-3"><p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">Modelo salvo. Use-o em <strong>Projetos → Modelos</strong>.</p><button className="btn-primary w-full" onClick={onClose}>Fechar</button></div>
      ) : (
        <form onSubmit={salvar} className="space-y-3">
          <Campo rotulo="Nome do modelo"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></Campo>
          <Campo rotulo="Descrição (opcional)"><input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
          <p className="text-xs text-slate-500">Leva tarefas, checklists, estimativas, prazos relativos, orçamento, valores de cobrança e custos recorrentes. Não leva horas, custos lançados, comentários, anexos nem responsáveis.</p>
          <Erro msg={erro} /><button className="btn-primary w-full">Salvar modelo</button>
        </form>
      )}
    </Modal>
  )
}
