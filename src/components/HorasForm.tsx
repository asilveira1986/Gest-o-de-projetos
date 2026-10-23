import { useState } from 'react'
import { excedeLimiteDia, round2, valorVendaEfetivo } from '../lib/calc'
import { hoje, parseHoras } from '../lib/format'
import { ok, supabase } from '../lib/supabase'
import { horasNoDia } from '../lib/timer'
import { useAuth } from '../lib/auth'
import type { Cliente, LancamentoHoras, Projeto } from '../lib/types'
import { Campo, Erro } from './ui'
import { useCarga } from './useAsync'

interface TarefaOpc {
  id: string
  titulo: string
  projeto_id: string
  projetos: (Projeto & { clientes: Cliente | null }) | null
}

/** Lançamento manual de horas (criar ou editar). */
export function HorasForm({
  tarefaId,
  lancamento,
  onSalvo,
}: {
  tarefaId?: string
  lancamento?: LancamentoHoras
  onSalvo: () => void
}) {
  const { usuario } = useAuth()
  const { dados: tarefas } = useCarga(async () => {
    const r = await supabase
      .from('tarefas')
      .select('id,titulo,projeto_id,projetos(*, clientes(*))')
      .neq('status', 'concluida')
      .order('titulo')
    return ok(r) as unknown as TarefaOpc[]
  }, [])

  const [tarefa, setTarefa] = useState(lancamento?.tarefa_id ?? tarefaId ?? '')
  const [data, setData] = useState(lancamento?.data ?? hoje())
  const [horas, setHoras] = useState(lancamento ? String(lancamento.horas).replace('.', ',') : '')
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '')
  const [faturavel, setFaturavel] = useState(lancamento?.faturavel ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario) return
    const h = parseHoras(horas)
    if (!tarefa) return setErro('Escolha a tarefa.')
    if (!(h > 0)) return setErro('Informe as horas (ex.: 1,5 ou 1:30).')
    setSalvando(true)
    try {
      const jaNoDia = await horasNoDia(lancamento?.usuario_id ?? usuario.id, data, lancamento?.id)
      if (excedeLimiteDia(jaNoDia, h) && !confirm(`Com este lançamento o dia passa de 12 h (${round2(jaNoDia + h)} h). Confirmar?`)) {
        setSalvando(false)
        return
      }
      if (lancamento) {
        ok(
          await supabase
            .from('lancamentos_horas')
            .update({ tarefa_id: tarefa, data, horas: round2(h), descricao: descricao || null, faturavel })
            .eq('id', lancamento.id),
        )
      } else {
        const t = tarefas?.find((x) => x.id === tarefa)
        const p = t?.projetos
        ok(
          await supabase.from('lancamentos_horas').insert({
            tarefa_id: tarefa,
            usuario_id: usuario.id,
            data,
            horas: round2(h),
            descricao: descricao || null,
            valor_hora_aplicado: usuario.valor_hora,
            valor_venda_aplicado: p ? valorVendaEfetivo(p, p.clientes) : 0,
            faturavel,
            origem: 'manual',
            estado: 'finalizado',
          }),
        )
      }
      onSalvo()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-3">
      {!tarefaId && !lancamento && (
        <Campo rotulo="Tarefa">
          <select className="input" value={tarefa} onChange={(e) => setTarefa(e.target.value)} required>
            <option value="">Selecione…</option>
            {tarefas?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.projetos?.nome} — {t.titulo}
              </option>
            ))}
          </select>
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} required />
        </Campo>
        <Campo rotulo="Horas">
          <input className="input" inputMode="decimal" placeholder="1,5 ou 1:30" value={horas} onChange={(e) => setHoras(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Descrição">
        <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={faturavel} onChange={(e) => setFaturavel(e.target.checked)} /> Faturável
      </label>
      <Erro msg={erro} />
      <button className="btn-primary w-full" disabled={salvando}>
        Salvar horas
      </button>
    </form>
  )
}
