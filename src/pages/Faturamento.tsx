import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Campo, Carregando, Erro, Indicador, Modal, Selo, Vazio } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { somarDias, statusFatura } from '../lib/calc'
import { brl, fmtData, fmtHoras, hoje } from '../lib/format'
import { ok, supabase } from '../lib/supabase'
import type { Custo, Fatura, LancamentoHoras } from '../lib/types'

type HoraPend = LancamentoHoras & { tarefas: { titulo: string; projeto_id: string; projetos: { nome: string; cliente_id: string | null } } }
type CustoPend = Custo & { projetos: { nome: string; cliente_id: string | null } }

interface GrupoCliente {
  clienteId: string
  nome: string
  horas: HoraPend[]
  custos: CustoPend[]
  total: number
}

const valorHora = (h: HoraPend) => h.horas * h.valor_venda_aplicado

export function Faturamento() {
  const [aba, setAba] = useState<'a_faturar' | 'faturas'>('a_faturar')
  const [gerar, setGerar] = useState<GrupoCliente | null>(null)
  const [avulsa, setAvulsa] = useState(false)
  const [pagar, setPagar] = useState<Fatura | null>(null)
  const hoje_ = hoje()

  const { dados, erro, carregando, recarregar } = useCarga(async () => {
    const [h, c, f, cl, pj] = await Promise.all([
      supabase.from('lancamentos_horas')
        .select('*, tarefas!inner(titulo,projeto_id,projetos!inner(nome,cliente_id,tipo_cobranca))')
        .eq('estado', 'finalizado').eq('faturavel', true).is('faturado_em', null)
        .eq('tarefas.projetos.tipo_cobranca', 'hora'),
      supabase.from('custos').select('*, projetos!inner(nome,cliente_id)')
        .eq('repassar_cliente', true).eq('situacao', 'realizado').is('faturado_em', null),
      supabase.from('faturas').select('*, clientes(nome)').order('vencimento', { ascending: false }),
      supabase.from('clientes').select('id,nome').order('nome'),
      supabase.from('projetos').select('id,nome,cliente_id,valor_fixo').eq('tipo_cobranca', 'fixo').eq('arquivado', false),
    ])
    return {
      horas: ok(h) as unknown as HoraPend[], custos: ok(c) as unknown as CustoPend[], faturas: ok(f) as Fatura[],
      clientes: ok(cl) as { id: string; nome: string }[],
      fixos: ok(pj) as { id: string; nome: string; cliente_id: string | null; valor_fixo: number | null }[],
    }
  }, [])

  const grupos = useMemo<GrupoCliente[]>(() => {
    if (!dados) return []
    const m = new Map<string, GrupoCliente>()
    const g = (id: string | null) => {
      const key = id ?? 'sem'
      if (!m.has(key)) m.set(key, { clienteId: key, nome: dados.clientes.find((c) => c.id === id)?.nome ?? 'Sem cliente', horas: [], custos: [], total: 0 })
      return m.get(key)!
    }
    dados.horas.forEach((h) => { const x = g(h.tarefas.projetos.cliente_id); x.horas.push(h); x.total += valorHora(h) })
    dados.custos.forEach((c) => { const x = g(c.projetos.cliente_id); x.custos.push(c); x.total += c.valor })
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [dados])

  const resumo = useMemo(() => {
    const fs = dados?.faturas ?? []
    const abertas = fs.filter((f) => statusFatura(f, hoje_) === 'aberta')
    const vencidas = fs.filter((f) => statusFatura(f, hoje_) === 'vencida')
    const mes = hoje_.slice(0, 7)
    return {
      aFaturar: grupos.reduce((s, g) => s + g.total, 0),
      aReceber: abertas.reduce((s, f) => s + f.valor, 0),
      vencido: vencidas.reduce((s, f) => s + f.valor, 0),
      recebidoMes: fs.filter((f) => f.pago_em?.startsWith(mes)).reduce((s, f) => s + (f.valor_pago ?? f.valor), 0),
    }
  }, [dados, grupos, hoje_])

  if (carregando && !dados) return <Carregando />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1>Faturamento</h1><p className="text-sm text-slate-500">Do trabalho feito ao dinheiro recebido.</p></div>
        <button className="btn-secondary" onClick={() => setAvulsa(true)}>+ Fatura avulsa (valor fixo)</button>
      </div>
      <Erro msg={erro} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="A faturar" valor={brl(resumo.aFaturar)} sub="Horas e repasses pendentes" />
        <Indicador rotulo="A receber" valor={brl(resumo.aReceber)} sub="Faturas em aberto" />
        <Indicador rotulo="Vencido" valor={brl(resumo.vencido)} cor={resumo.vencido > 0 ? '!text-red-600' : ''} />
        <Indicador rotulo="Recebido no mês" valor={brl(resumo.recebidoMes)} cor="!text-brand-600" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {([['a_faturar', 'A faturar'], ['faturas', 'Faturas e recebimentos']] as const).map(([k, n]) => (
          <button key={k} onClick={() => setAba(k)} className={`px-4 py-2 text-sm ${aba === k ? 'border-b-2 border-brand-600 font-semibold text-brand-700' : 'text-slate-600'}`}>{n}</button>
        ))}
      </div>

      {aba === 'a_faturar' && (!grupos.length ? <Vazio>Nada pendente de faturamento.</Vazio> : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.clienteId} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{g.nome}</p>
                  <p className="text-xs text-slate-500">{fmtHoras(g.horas.reduce((s, h) => s + h.horas, 0))} faturáveis · {g.custos.length} custo(s) repassado(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <strong className="text-lg">{brl(g.total)}</strong>
                  {g.clienteId !== 'sem' ? <button className="btn-primary" onClick={() => setGerar(g)}>Gerar fatura</button> : <Selo cor="amber">vincule um cliente ao projeto</Selo>}
                </div>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {[...new Set(g.horas.map((h) => h.tarefas.projetos.nome))].map((proj) => {
                  const hs = g.horas.filter((h) => h.tarefas.projetos.nome === proj)
                  return <li key={proj} className="flex justify-between py-1.5"><span>{proj} <span className="text-slate-400">· {fmtHoras(hs.reduce((s, h) => s + h.horas, 0))}</span></span><span>{brl(hs.reduce((s, h) => s + valorHora(h), 0))}</span></li>
                })}
                {g.custos.map((c) => <li key={c.id} className="flex justify-between py-1.5"><span>{c.projetos.nome} <span className="text-slate-400">· repasse: {c.descricao}</span></span><span>{brl(c.valor)}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {aba === 'faturas' && (!dados?.faturas.length ? <Vazio>Nenhuma fatura emitida.</Vazio> : (
        <div className="card overflow-x-auto p-0"><table className="w-full">
          <thead className="border-b bg-ink-50"><tr><th className="th">Cliente</th><th className="th">Descrição</th><th className="th">Emissão</th><th className="th">Vencimento</th><th className="th">Valor</th><th className="th">Situação</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{dados.faturas.map((f) => {
            const st = statusFatura(f, hoje_)
            return (
              <tr key={f.id}><td className="td font-medium">{f.clientes?.nome}</td><td className="td">{f.descricao ?? '—'}</td>
                <td className="td">{fmtData(f.emitida_em)}</td><td className="td">{fmtData(f.vencimento)}</td><td className="td">{brl(f.valor)}</td>
                <td className="td">{st === 'paga' ? <Selo cor="green">paga {fmtData(f.pago_em)}</Selo> : st === 'vencida' ? <Selo cor="red">vencida</Selo> : <Selo cor="amber">em aberto</Selo>}</td>
                <td className="td whitespace-nowrap text-right">
                  {st !== 'paga' ? <button className="text-brand-700" onClick={() => setPagar(f)}>registrar pagamento</button>
                    : <button className="text-slate-500" onClick={async () => { ok(await supabase.from('faturas').update({ pago_em: null, valor_pago: null }).eq('id', f.id)); void recarregar() }}>desfazer</button>}
                </td></tr>
            )
          })}</tbody></table></div>
      ))}
      <p className="text-xs text-slate-500">Para o PDF a enviar ao cliente, use <Link className="text-brand-700 underline" to="/relatorios">Relatórios</Link>.</p>

      {gerar && <Modal titulo={`Gerar fatura — ${gerar.nome}`} onClose={() => setGerar(null)}><FormGerar grupo={gerar} onSalvo={() => { setGerar(null); setAba('faturas'); void recarregar() }} /></Modal>}
      {avulsa && dados && <Modal titulo="Fatura avulsa" onClose={() => setAvulsa(false)}><FormAvulsa clientes={dados.clientes} fixos={dados.fixos} onSalvo={() => { setAvulsa(false); setAba('faturas'); void recarregar() }} /></Modal>}
      {pagar && <Modal titulo="Registrar pagamento" onClose={() => setPagar(null)}><FormPagamento fatura={pagar} onSalvo={() => { setPagar(null); void recarregar() }} /></Modal>}
    </div>
  )
}

function FormGerar({ grupo, onSalvo }: { grupo: GrupoCliente; onSalvo: () => void }) {
  const [emissao] = useState(hoje())
  const [venc, setVenc] = useState(somarDias(hoje(), 15))
  const [desc, setDesc] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const fat = ok(await supabase.from('faturas').insert({
        cliente_id: grupo.clienteId, descricao: desc || null, emitida_em: emissao, vencimento: venc, valor: Math.round(grupo.total * 100) / 100,
      }).select('id').single()) as { id: string }
      // marca os itens como faturados e liga à fatura (não cobra duas vezes)
      if (grupo.horas.length) ok(await supabase.from('lancamentos_horas').update({ faturado_em: emissao, fatura_id: fat.id }).in('id', grupo.horas.map((h) => h.id)))
      if (grupo.custos.length) ok(await supabase.from('custos').update({ faturado_em: emissao, fatura_id: fat.id }).in('id', grupo.custos.map((c) => c.id)))
      onSalvo()
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <form onSubmit={salvar} className="space-y-3">
      <p className="rounded-lg bg-ink-50 p-3 text-sm">{grupo.horas.length} lançamento(s) de horas + {grupo.custos.length} custo(s) repassado(s) = <strong>{brl(grupo.total)}</strong></p>
      <Campo rotulo="Vencimento"><input type="date" className="input" value={venc} onChange={(e) => setVenc(e.target.value)} required /></Campo>
      <Campo rotulo="Descrição (opcional)"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Serviços de outubro/2026" /></Campo>
      <Erro msg={erro} /><button className="btn-primary w-full" disabled={salvando}>Gerar e marcar como faturado</button>
    </form>
  )
}

function FormAvulsa({ clientes, fixos, onSalvo }: { clientes: { id: string; nome: string }[]; fixos: { id: string; nome: string; cliente_id: string | null; valor_fixo: number | null }[]; onSalvo: () => void }) {
  const [projeto, setProjeto] = useState('')
  const [cliente, setCliente] = useState('')
  const [valor, setValor] = useState('')
  const [venc, setVenc] = useState(somarDias(hoje(), 15))
  const [desc, setDesc] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function escolherProjeto(id: string) {
    setProjeto(id)
    const p = fixos.find((x) => x.id === id)
    if (p) { setCliente(p.cliente_id ?? ''); if (p.valor_fixo) setValor(String(p.valor_fixo).replace('.', ',')); if (!desc) setDesc(p.nome) }
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!cliente) return setErro('Escolha o cliente.')
    if (!(v > 0)) return setErro('Informe um valor maior que zero.')
    try {
      ok(await supabase.from('faturas').insert({ cliente_id: cliente, projeto_id: projeto || null, descricao: desc || null, vencimento: venc, valor: v }))
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }
  return (
    <form onSubmit={salvar} className="space-y-3">
      <Campo rotulo="Projeto de valor fixo (opcional)"><select className="input" value={projeto} onChange={(e) => escolherProjeto(e.target.value)}><option value="">Nenhum</option>{fixos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
      <Campo rotulo="Cliente"><select className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} required><option value="">Selecione…</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)"><input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo rotulo="Vencimento"><input type="date" className="input" value={venc} onChange={(e) => setVenc(e.target.value)} required /></Campo>
      </div>
      <Campo rotulo="Descrição"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Campo>
      <Erro msg={erro} /><button className="btn-primary w-full">Emitir fatura</button>
    </form>
  )
}

function FormPagamento({ fatura, onSalvo }: { fatura: Fatura; onSalvo: () => void }) {
  const [data, setData] = useState(hoje())
  const [valor, setValor] = useState(String(fatura.valor).replace('.', ','))
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    try {
      ok(await supabase.from('faturas').update({ pago_em: data, valor_pago: Number(valor.replace(/\./g, '').replace(',', '.')) }).eq('id', fatura.id))
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }
  return (
    <form onSubmit={salvar} className="space-y-3">
      <p className="text-sm text-slate-600">{fatura.clientes?.nome} · vencimento {fmtData(fatura.vencimento)} · {brl(fatura.valor)}</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data do pagamento"><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} required /></Campo>
        <Campo rotulo="Valor recebido (R$)"><input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
      </div>
      <Erro msg={erro} /><button className="btn-primary w-full">Confirmar recebimento</button>
    </form>
  )
}
