import { useState } from 'react'
import { brl, fmtData, hoje } from '../lib/format'
import { conferirNota, lerXmlNfse, montarDadosNota, pendenciasNota, URL_PORTAL_NFSE, type ConfigNfse } from '../lib/nfse'
import { enviarArquivo, ok, supabase, urlAssinada } from '../lib/supabase'
import type { Cliente, Fatura } from '../lib/types'
import { Campo, Carregando, Erro, Modal, Selo } from './ui'
import { useCarga } from './useAsync'

/** Linha com rótulo, valor e botão de copiar (para colar no portal). */
function Copiar({ rotulo, valor, multilinha }: { rotulo: string; valor: string; multilinha?: boolean }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try { await navigator.clipboard.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch { /* sem permissão: usuário copia à mão */ }
  }
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{rotulo}</p>
        <p className={`text-sm ${multilinha ? 'whitespace-pre-wrap' : 'truncate'} ${valor ? '' : 'text-slate-400'}`}>{valor || '— não informado —'}</p>
      </div>
      {valor && <button type="button" className="btn-secondary !px-2.5 !py-1 text-xs" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>}
    </div>
  )
}

type ItemHoras = { horas: number; tarefas: { projetos: { nome: string } } }

export function NfseModal({ fatura, onClose, onSalvo }: { fatura: Fatura; onClose: () => void; onSalvo: () => void }) {
  const [aba, setAba] = useState<'dados' | 'registrar'>(fatura.nfse_status === 'emitida' ? 'registrar' : 'dados')
  const { dados, erro, carregando } = useCarga(async () => {
    const [c, cfg, h] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', fatura.cliente_id).single(),
      supabase.from('configuracoes').select('*').eq('id', 1).single(),
      supabase.from('lancamentos_horas').select('horas,tarefas(projetos(nome))').eq('fatura_id', fatura.id),
    ])
    return {
      cliente: ok(c) as Cliente, config: ok(cfg) as ConfigNfse,
      itens: (ok(h) as unknown as ItemHoras[]).map((x) => ({ projeto: x.tarefas.projetos.nome, horas: x.horas })),
    }
  }, [fatura.id])

  return (
    <Modal titulo={`NFS-e — ${fatura.clientes?.nome ?? 'fatura'} · ${brl(fatura.valor)}`} onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {([['dados', '1. Dados para emitir'], ['registrar', '2. Registrar nota emitida']] as const).map(([k, n]) => (
          <button key={k} onClick={() => setAba(k)} className={`px-3 py-2 text-sm ${aba === k ? 'border-b-2 border-brand-600 font-semibold text-brand-700' : 'text-slate-600'}`}>{n}</button>
        ))}
      </div>
      <Erro msg={erro} />
      {carregando && !dados ? <Carregando /> : dados && (aba === 'dados'
        ? <DadosParaEmitir fatura={fatura} {...dados} onProxima={() => setAba('registrar')} />
        : <Registrar fatura={fatura} cliente={dados.cliente} onSalvo={onSalvo} />)}
    </Modal>
  )
}

function DadosParaEmitir({ fatura, cliente, config, itens, onProxima }: { fatura: Fatura; cliente: Cliente; config: ConfigNfse; itens: { projeto: string; horas: number }[]; onProxima: () => void }) {
  const d = montarDadosNota(fatura, cliente, config, itens)
  const pend = pendenciasNota(d)
  return (
    <div className="space-y-3">
      {pend.map((p) => (
        <p key={p.texto} className={`rounded-lg px-3 py-2 text-sm ${p.bloqueia ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{p.bloqueia ? '⛔' : '⚠️'} {p.texto}</p>
      ))}
      <div className="rounded-lg border border-slate-200 px-3">
        <Copiar rotulo={`Tomador — ${d.tomador.tipo ?? 'documento'}`} valor={d.tomador.documento} />
        <Copiar rotulo="Tomador — nome / razão social" valor={d.tomador.nome} />
        {d.tomador.email && <Copiar rotulo="E-mail" valor={d.tomador.email} />}
        {d.tomador.endereco && <Copiar rotulo="Endereço" valor={d.tomador.endereco} />}
        <Copiar rotulo="Código do serviço" valor={d.servico.codigo} />
        <Copiar rotulo="Município de prestação" valor={d.servico.municipio} />
        <Copiar rotulo="Descrição do serviço" valor={d.servico.descricao} multilinha />
        <Copiar rotulo="Valor do serviço" valor={d.valor.toFixed(2).replace('.', ',')} />
        <Copiar rotulo="Competência" valor={d.competencia} />
      </div>
      <div className="flex gap-2">
        <a className="btn-primary flex-1" href={URL_PORTAL_NFSE} target="_blank" rel="noreferrer">Abrir portal do governo ↗</a>
        <button className="btn-secondary" onClick={onProxima}>Já emiti →</button>
      </div>
      <p className="text-xs text-slate-500">Entre no portal com sua conta gov.br, emita a nota com estes dados, baixe o PDF e o XML e volte aqui para registrá-la. Os nomes dos campos no portal podem variar um pouco.</p>
    </div>
  )
}

function Registrar({ fatura, cliente, onSalvo }: { fatura: Fatura; cliente: Cliente; onSalvo: () => void }) {
  const [numero, setNumero] = useState(fatura.nfse_numero ?? '')
  const [chave, setChave] = useState(fatura.nfse_chave ?? '')
  const [data, setData] = useState(fatura.nfse_emitida_em ?? hoje())
  const [valor, setValor] = useState(String(fatura.nfse_valor ?? fatura.valor).replace('.', ','))
  const [docTomador, setDocTomador] = useState<string | undefined>()
  const [pdf, setPdf] = useState<File | null>(null)
  const [xml, setXml] = useState<File | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const valorNum = Number(valor.replace(/\./g, '').replace(',', '.'))
  const avisos = conferirNota(fatura, cliente, { valor: valorNum, documentoTomador: docTomador, chave: chave || undefined })

  async function aoEscolherXml(f: File | null) {
    setXml(f); setMsg(null)
    if (!f) return
    const x = lerXmlNfse(await f.text())
    if (x.numero) setNumero(x.numero)
    if (x.chave) setChave(x.chave)
    if (x.emitidaEm) setData(x.emitidaEm)
    if (x.valor != null) setValor(String(x.valor).replace('.', ','))
    setDocTomador(x.documentoTomador ?? undefined)
    setMsg(x.numero || x.chave || x.valor != null ? 'Campos preenchidos a partir do XML — confira antes de salvar.' : 'Não consegui ler dados deste XML; preencha os campos manualmente.')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!numero.trim()) return setErro('Informe o número da nota.')
    if (!(valorNum > 0)) return setErro('Informe o valor da nota.')
    if (avisos.length && !confirm(`Atenção:\n- ${avisos.join('\n- ')}\n\nSalvar mesmo assim?`)) return
    setSalvando(true)
    try {
      const nfse_pdf = pdf ? await enviarArquivo('anexos', pdf, `nfse/${fatura.id}`) : fatura.nfse_pdf
      const nfse_xml = xml ? await enviarArquivo('anexos', xml, `nfse/${fatura.id}`) : fatura.nfse_xml
      ok(await supabase.from('faturas').update({
        nfse_status: 'emitida', nfse_numero: numero.trim(), nfse_chave: chave.trim() || null, nfse_emitida_em: data, nfse_valor: valorNum, nfse_pdf, nfse_xml,
      }).eq('id', fatura.id))
      onSalvo()
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }

  async function mudarStatus(status: 'pendente' | 'dispensada') {
    const texto = status === 'dispensada' ? 'Marcar esta fatura como sem NFS-e?' : 'Voltar esta fatura para "NFS-e pendente"? Os dados da nota registrada serão limpos.'
    if (!confirm(texto)) return
    try {
      ok(await supabase.from('faturas').update(status === 'pendente'
        ? { nfse_status: 'pendente', nfse_numero: null, nfse_chave: null, nfse_emitida_em: null, nfse_valor: null, nfse_pdf: null, nfse_xml: null }
        : { nfse_status: 'dispensada' }).eq('id', fatura.id))
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }

  async function abrir(caminho: string | null) {
    const u = caminho && (await urlAssinada('anexos', caminho))
    if (u) window.open(u, '_blank')
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      {fatura.nfse_status === 'emitida' && <p className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800"><Selo cor="green">emitida</Selo> nº {fatura.nfse_numero} em {fmtData(fatura.nfse_emitida_em)}
        {fatura.nfse_pdf && <button type="button" className="underline" onClick={() => abrir(fatura.nfse_pdf)}>PDF</button>}
        {fatura.nfse_xml && <button type="button" className="underline" onClick={() => abrir(fatura.nfse_xml)}>XML</button>}</p>}
      <Campo rotulo="XML da nota (opcional — preenche os campos sozinho)"><input type="file" accept=".xml,text/xml,application/xml" className="text-sm" onChange={(e) => void aoEscolherXml(e.target.files?.[0] ?? null)} /></Campo>
      {msg && <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm">{msg}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Número da NFS-e"><input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} required /></Campo>
        <Campo rotulo="Data de emissão"><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} required /></Campo>
        <Campo rotulo="Valor da nota (R$)"><input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo rotulo="Chave de acesso (50 dígitos)"><input className="input" value={chave} onChange={(e) => setChave(e.target.value)} /></Campo>
      </div>
      <Campo rotulo="PDF da nota"><input type="file" accept="application/pdf" className="text-sm" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} /></Campo>
      {avisos.map((a) => <p key={a} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">⚠️ {a}</p>)}
      <Erro msg={erro} />
      <button className="btn-primary w-full" disabled={salvando}>{fatura.nfse_status === 'emitida' ? 'Atualizar nota' : 'Registrar NFS-e emitida'}</button>
      <div className="flex justify-between text-xs">
        {fatura.nfse_status !== 'dispensada' && <button type="button" className="text-slate-600 hover:underline" onClick={() => mudarStatus('dispensada')}>Esta fatura não precisa de nota</button>}
        {fatura.nfse_status !== 'pendente' && <button type="button" className="text-red-600 hover:underline" onClick={() => mudarStatus('pendente')}>Voltar para pendente</button>}
      </div>
    </form>
  )
}
