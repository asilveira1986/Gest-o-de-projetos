import { useState } from 'react'
import { Campo, Carregando, Erro, Modal, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { carregarResumos } from '../lib/dados'
import { brl } from '../lib/format'
import { ok, supabase } from '../lib/supabase'
import type { Cliente } from '../lib/types'

export function Clientes() {
  const [edit, setEdit] = useState<Cliente | 'novo' | null>(null)
  const { dados, erro, carregando, recarregar } = useCarga(async () => {
    const clientes = ok(await supabase.from('clientes').select('*').order('nome')) as Cliente[]
    const resumos = await carregarResumos(true)
    return clientes.map((c) => {
      const rs = resumos.filter((r) => r.projeto.cliente_id === c.id)
      const receita = rs.reduce((s, r) => s + r.receita, 0), custo = rs.reduce((s, r) => s + r.custo, 0)
      return { c, projetos: rs.length, receita, custo, margem: receita - custo }
    })
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold">Clientes</h1><button className="btn-primary" onClick={() => setEdit('novo')}>+ Cliente</button></div>
      <Erro msg={erro} />
      {carregando ? <Carregando /> : !dados?.length ? <Vazio>Nenhum cliente.</Vazio> : (
        <div className="card overflow-x-auto p-0"><table className="w-full">
          <thead className="border-b bg-slate-50"><tr><th className="th">Cliente</th><th className="th">Contato</th><th className="th">Valor/hora</th><th className="th">Projetos</th><th className="th">Receita</th><th className="th">Custo</th><th className="th">Margem</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{dados.map(({ c, projetos, receita, custo, margem }) => (
            <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEdit(c)}>
              <td className="td font-medium">{c.nome}<span className="block text-xs font-normal text-slate-500">{c.documento}</span></td>
              <td className="td">{c.email}<span className="block text-xs text-slate-500">{c.telefone}</span></td>
              <td className="td">{brl(c.valor_hora_venda_padrao)}</td><td className="td">{projetos}</td>
              <td className="td">{brl(receita)}</td><td className="td">{brl(custo)}</td>
              <td className={`td font-medium ${margem < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{brl(margem)}</td></tr>))}
          </tbody></table></div>
      )}
      {edit && <Modal titulo={edit === 'novo' ? 'Novo cliente' : 'Editar cliente'} onClose={() => setEdit(null)}>
        <ClienteForm cliente={edit === 'novo' ? undefined : edit} onSalvo={() => { setEdit(null); void recarregar() }} /></Modal>}
    </div>
  )
}

function ClienteForm({ cliente, onSalvo }: { cliente?: Cliente; onSalvo: () => void }) {
  const [f, setF] = useState({ nome: cliente?.nome ?? '', documento: cliente?.documento ?? '', email: cliente?.email ?? '', telefone: cliente?.telefone ?? '',
    valor: cliente ? String(cliente.valor_hora_venda_padrao).replace('.', ',') : '' })
  const [erro, setErro] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const row = { nome: f.nome, documento: f.documento || null, email: f.email || null, telefone: f.telefone || null,
      valor_hora_venda_padrao: f.valor ? Number(f.valor.replace(/\./g, '').replace(',', '.')) : 0 }
    try {
      if (cliente) ok(await supabase.from('clientes').update(row).eq('id', cliente.id)); else ok(await supabase.from('clientes').insert(row))
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }
  return (
    <form onSubmit={salvar} className="space-y-3">
      <Campo rotulo="Nome"><input className="input" value={f.nome} onChange={(e) => set('nome', e.target.value)} required autoFocus /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="CPF/CNPJ"><input className="input" value={f.documento} onChange={(e) => set('documento', e.target.value)} /></Campo>
        <Campo rotulo="Telefone"><input className="input" value={f.telefone} onChange={(e) => set('telefone', e.target.value)} /></Campo>
        <Campo rotulo="E-mail"><input type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Campo>
        <Campo rotulo="Valor/hora de venda (R$)"><input className="input" inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} /></Campo>
      </div>
      <Erro msg={erro} /><button className="btn-primary w-full">Salvar</button>
    </form>
  )
}
