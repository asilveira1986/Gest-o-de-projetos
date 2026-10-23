import { useState } from 'react'
import { hoje } from '../lib/format'
import { enviarArquivo, ok, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Custo } from '../lib/types'
import { Campo, Erro } from './ui'
import { useCarga } from './useAsync'

/** Lançamento de custo direto (criar ou editar), com comprovante opcional. */
export function CustoForm({
  projetoId,
  tarefaId,
  custo,
  onSalvo,
}: {
  projetoId?: string
  tarefaId?: string
  custo?: Custo
  onSalvo: () => void
}) {
  const { usuario } = useAuth()
  const { dados: ref } = useCarga(async () => {
    const [p, c, t] = await Promise.all([
      supabase.from('projetos').select('id,nome').eq('arquivado', false).order('nome'),
      supabase.from('categorias_custo').select('nome').order('nome'),
      supabase.from('tarefas').select('id,titulo,projeto_id').order('titulo'),
    ])
    return {
      projetos: ok(p) as { id: string; nome: string }[],
      categorias: ok(c) as { nome: string }[],
      tarefas: ok(t) as { id: string; titulo: string; projeto_id: string }[],
    }
  }, [])

  const [projeto, setProjeto] = useState(custo?.projeto_id ?? projetoId ?? '')
  const [tarefa, setTarefa] = useState(custo?.tarefa_id ?? tarefaId ?? '')
  const [data, setData] = useState(custo?.data ?? hoje())
  const [descricao, setDescricao] = useState(custo?.descricao ?? '')
  const [categoria, setCategoria] = useState(custo?.categoria ?? '')
  const [valor, setValor] = useState(custo ? String(custo.valor).replace('.', ',') : '')
  const [fornecedor, setFornecedor] = useState(custo?.fornecedor ?? '')
  const [situacao, setSituacao] = useState<Custo['situacao']>(custo?.situacao ?? 'realizado')
  const [repassar, setRepassar] = useState(custo?.repassar_cliente ?? false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!projeto) return setErro('Escolha o projeto.')
    if (!(v > 0)) return setErro('Informe um valor maior que zero.')
    setSalvando(true)
    try {
      const comprovante = arquivo ? await enviarArquivo('comprovantes', arquivo, projeto) : custo?.comprovante_url ?? null
      const row = {
        projeto_id: projeto,
        tarefa_id: tarefa || null,
        data,
        descricao,
        categoria: categoria || ref?.categorias[0]?.nome || 'Outros',
        valor: v,
        fornecedor: fornecedor || null,
        situacao,
        repassar_cliente: repassar,
        comprovante_url: comprovante,
      }
      if (custo) ok(await supabase.from('custos').update(row).eq('id', custo.id))
      else ok(await supabase.from('custos').insert({ ...row, usuario_id: usuario?.id }))
      onSalvo()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  const tarefasDoProjeto = ref?.tarefas.filter((t) => t.projeto_id === projeto) ?? []

  return (
    <form onSubmit={salvar} className="space-y-3">
      {!projetoId && (
        <Campo rotulo="Projeto">
          <select className="input" value={projeto} onChange={(e) => { setProjeto(e.target.value); setTarefa('') }} required>
            <option value="">Selecione…</option>
            {ref?.projetos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)">
          <input className="input" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus />
        </Campo>
        <Campo rotulo="Categoria">
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {ref?.categorias.map((c) => (
              <option key={c.nome}>{c.nome}</option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo rotulo="Descrição">
        <input className="input" value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} required />
        </Campo>
        <Campo rotulo="Situação">
          <select className="input" value={situacao} onChange={(e) => setSituacao(e.target.value as Custo['situacao'])}>
            <option value="realizado">Realizado</option>
            <option value="previsto">Previsto</option>
          </select>
        </Campo>
      </div>
      <Campo rotulo="Fornecedor (opcional)">
        <input className="input" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
      </Campo>
      {projeto && (
        <Campo rotulo="Tarefa vinculada (opcional)">
          <select className="input" value={tarefa} onChange={(e) => setTarefa(e.target.value)}>
            <option value="">Nenhuma</option>
            {tarefasDoProjeto.map((t) => (
              <option key={t.id} value={t.id}>{t.titulo}</option>
            ))}
          </select>
        </Campo>
      )}
      <Campo rotulo="Comprovante (foto/PDF)">
        <input type="file" accept="image/*,application/pdf" capture="environment" className="text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={repassar} onChange={(e) => setRepassar(e.target.checked)} /> Repassar ao cliente
      </label>
      <Erro msg={erro} />
      <button className="btn-primary w-full" disabled={salvando}>Salvar custo</button>
    </form>
  )
}
