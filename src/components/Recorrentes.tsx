import { useState } from 'react'
import { brl, fmtData, hoje } from '../lib/format'
import { gerarCustosRecorrentes } from '../lib/recorrentes'
import { proximaOcorrencia, ROTULO_FREQUENCIA } from '../lib/recorrencia'
import { ok, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CustoRecorrente } from '../lib/types'
import { Campo, Erro, Modal, Selo } from './ui'
import { useCarga } from './useAsync'

/** Seção "Custos recorrentes" da aba Custos do projeto. */
export function Recorrentes({ projetoId, onMudou }: { projetoId: string; onMudou: () => void }) {
  const { usuario } = useAuth()
  const [novo, setNovo] = useState(false)
  const [edit, setEdit] = useState<CustoRecorrente | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const { dados, recarregar } = useCarga(
    async () => ok(await supabase.from('custos_recorrentes').select('*').eq('projeto_id', projetoId).order('descricao')) as CustoRecorrente[], [projetoId])

  const tenta = async (fn: () => Promise<unknown>) => { try { setErro(null); await fn(); await recarregar(); onMudou() } catch (e) { setErro((e as Error).message) } }
  const alternar = (r: CustoRecorrente) => tenta(async () => ok(await supabase.from('custos_recorrentes').update({ ativo: !r.ativo }).eq('id', r.id)))
  const excluir = (r: CustoRecorrente) => {
    if (!confirm('Excluir esta recorrência? Os custos já lançados são mantidos.')) return
    return tenta(async () => ok(await supabase.from('custos_recorrentes').delete().eq('id', r.id)))
  }
  const gerar = () => tenta(async () => {
    const n = await gerarCustosRecorrentes(usuario?.id)
    setMsg(n ? `${n} custo(s) lançado(s).` : 'Nada novo para lançar.')
  })

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-medium">Custos recorrentes</h2><p className="text-xs text-slate-500">Licenças, hospedagem, assinaturas: lançados sozinhos na data de cada ocorrência.</p></div>
        <div className="flex gap-2"><button className="btn-secondary" onClick={gerar}>Lançar vencidos agora</button><button className="btn-primary" onClick={() => setNovo(true)}>+ Recorrente</button></div>
      </div>
      <Erro msg={erro} />
      {msg && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{msg}</p>}
      {!dados?.length ? <p className="text-sm text-slate-500">Nenhum custo recorrente.</p> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {dados.map((r) => {
            const prox = r.ativo ? proximaOcorrencia(r, r.ultima_geracao && r.ultima_geracao > hoje() ? r.ultima_geracao : hoje()) : null
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className={r.ativo ? '' : 'opacity-50'}>
                  <p className="font-medium">{r.descricao} <Selo>{r.categoria}</Selo> {r.repassar_cliente && <Selo cor="blue">repasse</Selo>}</p>
                  <p className="text-xs text-slate-500">
                    {brl(r.valor)} · {ROTULO_FREQUENCIA[r.frequencia]}{r.frequencia === 'mensal' && r.dia_mes ? ` (dia ${r.dia_mes})` : ''} · desde {fmtData(r.inicio)}{r.fim ? ` até ${fmtData(r.fim)}` : ''}
                    {prox && ` · próximo: ${fmtData(prox)}`}{!r.ativo && ' · pausado'}
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button className="text-brand-700" onClick={() => setEdit(r)}>editar</button>
                  <button className="text-slate-600" onClick={() => alternar(r)}>{r.ativo ? 'pausar' : 'retomar'}</button>
                  <button className="text-red-600" onClick={() => excluir(r)}>excluir</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {(novo || edit) && (
        <Modal titulo={edit ? 'Editar custo recorrente' : 'Novo custo recorrente'} onClose={() => { setNovo(false); setEdit(null) }}>
          <RecorrenteForm projetoId={projetoId} regra={edit ?? undefined}
            onSalvo={() => { setNovo(false); setEdit(null); void recarregar(); onMudou() }} />
        </Modal>
      )}
    </div>
  )
}

function RecorrenteForm({ projetoId, regra, onSalvo }: { projetoId: string; regra?: CustoRecorrente; onSalvo: () => void }) {
  const { dados: categorias } = useCarga(async () => ok(await supabase.from('categorias_custo').select('nome').order('nome')) as { nome: string }[], [])
  const [f, setF] = useState({
    descricao: regra?.descricao ?? '', categoria: regra?.categoria ?? 'Software/Licença',
    valor: regra ? String(regra.valor).replace('.', ',') : '', fornecedor: regra?.fornecedor ?? '',
    frequencia: regra?.frequencia ?? 'mensal', dia_mes: String(regra?.dia_mes ?? new Date().getDate()),
    inicio: regra?.inicio ?? hoje(), fim: regra?.fim ?? '', repassar: regra?.repassar_cliente ?? false,
  })
  const [erro, setErro] = useState<string | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const valor = Number(f.valor.replace(/\./g, '').replace(',', '.'))
    if (!(valor > 0)) return setErro('Informe um valor maior que zero.')
    if (f.fim && f.fim < f.inicio) return setErro('A data final não pode ser anterior ao início.')
    const dia = Number(f.dia_mes)
    if (f.frequencia === 'mensal' && !(dia >= 1 && dia <= 31)) return setErro('Dia do mês deve ser de 1 a 31.')
    const row = {
      projeto_id: projetoId, descricao: f.descricao, categoria: f.categoria, valor, fornecedor: f.fornecedor || null,
      frequencia: f.frequencia, dia_mes: f.frequencia === 'mensal' ? dia : null, inicio: f.inicio, fim: f.fim || null, repassar_cliente: f.repassar,
    }
    try {
      // a última geração é mantida: só ocorrências posteriores a ela serão lançadas
      if (regra) ok(await supabase.from('custos_recorrentes').update(row).eq('id', regra.id))
      else ok(await supabase.from('custos_recorrentes').insert(row))
      onSalvo()
    } catch (e) { setErro((e as Error).message) }
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      <Campo rotulo="Descrição"><input className="input" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} required autoFocus placeholder="Ex.: Licença do Figma" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)"><input className="input" inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} required /></Campo>
        <Campo rotulo="Categoria"><select className="input" value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>{categorias?.map((c) => <option key={c.nome}>{c.nome}</option>)}</select></Campo>
        <Campo rotulo="Frequência"><select className="input" value={f.frequencia} onChange={(e) => set('frequencia', e.target.value as typeof f.frequencia)}><option value="semanal">Semanal</option><option value="mensal">Mensal</option><option value="anual">Anual</option></select></Campo>
        {f.frequencia === 'mensal' && <Campo rotulo="Dia do mês"><input className="input" type="number" min={1} max={31} value={f.dia_mes} onChange={(e) => set('dia_mes', e.target.value)} /></Campo>}
        <Campo rotulo="Começa em"><input type="date" className="input" value={f.inicio} onChange={(e) => set('inicio', e.target.value)} required /></Campo>
        <Campo rotulo="Termina em (opcional)"><input type="date" className="input" value={f.fim} onChange={(e) => set('fim', e.target.value)} /></Campo>
      </div>
      <Campo rotulo="Fornecedor (opcional)"><input className="input" value={f.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} /></Campo>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.repassar} onChange={(e) => set('repassar', e.target.checked)} /> Repassar ao cliente</label>
      <p className="text-xs text-slate-500">Ocorrências que já venceram são lançadas como <strong>realizado</strong> na próxima vez que o sistema abrir.</p>
      <Erro msg={erro} /><button className="btn-primary w-full">Salvar</button>
    </form>
  )
}
