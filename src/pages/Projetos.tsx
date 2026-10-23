import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarraOrcamento, Campo, Carregando, Erro, Modal, Selo, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { carregarResumos } from '../lib/dados'
import { brl, fmtData, fmtPct } from '../lib/format'
import { ok, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { STATUS_PROJETO, type Cliente, type Projeto, type StatusProjeto, type Usuario } from '../lib/types'

export function Projetos() {
  const [arquivados, setArquivados] = useState(false)
  const [novo, setNovo] = useState(false)
  const { dados, erro, carregando, recarregar } = useCarga(() => carregarResumos(arquivados), [arquivados])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Projetos</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> Mostrar arquivados
          </label>
          <button className="btn-primary" onClick={() => setNovo(true)}>+ Projeto</button>
        </div>
      </div>
      <Erro msg={erro} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio>Nenhum projeto.</Vazio> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-ink-50">
              <tr><th className="th">Projeto</th><th className="th">Cliente</th><th className="th">Prazo</th><th className="th">Status</th><th className="th w-48">Orçamento</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dados.map((r) => (
                <tr key={r.projeto.id} className="hover:bg-ink-50">
                  <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/projetos/${r.projeto.id}`}>{r.projeto.nome}</Link>{r.projeto.arquivado && <> <Selo>arquivado</Selo></>}</td>
                  <td className="td">{r.projeto.clientes?.nome ?? '—'}</td>
                  <td className="td">{fmtData(r.projeto.prazo)}</td>
                  <td className="td">{STATUS_PROJETO[r.projeto.status]}</td>
                  <td className="td"><div className="mb-1 text-xs">{brl(r.custo)} · {fmtPct(r.pct)}</div><BarraOrcamento pct={r.pct} alerta={r.alerta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {novo && <Modal titulo="Novo projeto" onClose={() => setNovo(false)}><ProjetoForm onSalvo={() => { setNovo(false); void recarregar() }} /></Modal>}
    </div>
  )
}

export function ProjetoForm({ projeto, onSalvo }: { projeto?: Projeto; onSalvo: () => void }) {
  const { usuario } = useAuth()
  const { dados: ref } = useCarga(async () => ({
    clientes: ok(await supabase.from('clientes').select('*').order('nome')) as Cliente[],
    usuarios: ok(await supabase.from('usuarios').select('*').eq('ativo', true).order('nome')) as Usuario[],
  }), [])
  const [f, setF] = useState({
    nome: projeto?.nome ?? '',
    cliente_id: projeto?.cliente_id ?? '',
    descricao: projeto?.descricao ?? '',
    data_inicio: projeto?.data_inicio ?? '',
    prazo: projeto?.prazo ?? '',
    orcamento: projeto ? String(projeto.orcamento).replace('.', ',') : '',
    valor_hora_venda: projeto?.valor_hora_venda != null ? String(projeto.valor_hora_venda).replace('.', ',') : '',
    status: (projeto?.status ?? 'planejado') as StatusProjeto,
    responsavel_id: projeto?.responsavel_id ?? usuario?.id ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))
  const cliente = ref?.clientes.find((c) => c.id === f.cliente_id)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const row = {
      nome: f.nome,
      cliente_id: f.cliente_id || null,
      descricao: f.descricao || null,
      data_inicio: f.data_inicio || null,
      prazo: f.prazo || null,
      orcamento: f.orcamento ? num(f.orcamento) : 0,
      valor_hora_venda: f.valor_hora_venda ? num(f.valor_hora_venda) : null,
      status: f.status,
      responsavel_id: f.responsavel_id || null,
    }
    try {
      if (projeto) ok(await supabase.from('projetos').update(row).eq('id', projeto.id))
      else {
        const novo = ok(await supabase.from('projetos').insert(row).select('id').single()) as { id: string }
        if (row.responsavel_id) ok(await supabase.from('projeto_membros').insert({ projeto_id: novo.id, usuario_id: row.responsavel_id }))
      }
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <Campo rotulo="Nome"><input className="input" value={f.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus /></Campo>
      <Campo rotulo="Cliente (opcional)">
        <select className="input" value={f.cliente_id} onChange={(e) => set('cliente_id', e.target.value)}>
          <option value="">Sem cliente</option>
          {ref?.clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Descrição"><textarea className="input" rows={2} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Início"><input type="date" className="input" value={f.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} /></Campo>
        <Campo rotulo="Prazo"><input type="date" className="input" value={f.prazo} onChange={(e) => set('prazo', e.target.value)} /></Campo>
        <Campo rotulo="Orçamento (R$)"><input className="input" inputMode="decimal" value={f.orcamento} onChange={(e) => set('orcamento', e.target.value)} /></Campo>
        <Campo rotulo="Valor/hora de venda (R$)">
          <input className="input" inputMode="decimal" value={f.valor_hora_venda} onChange={(e) => set('valor_hora_venda', e.target.value)}
            placeholder={cliente ? `Herda do cliente: ${brl(cliente.valor_hora_venda_padrao)}` : 'Herda do cliente'} />
        </Campo>
        <Campo rotulo="Status">
          <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(STATUS_PROJETO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Responsável principal">
          <select className="input" value={f.responsavel_id} onChange={(e) => set('responsavel_id', e.target.value)}>
            <option value="">—</option>
            {ref?.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>
      </div>
      <Erro msg={erro} />
      <button className="btn-primary w-full">Salvar</button>
    </form>
  )
}
