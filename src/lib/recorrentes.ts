import { hoje } from './format'
import { ocorrenciasDe } from './recorrencia'
import { ok, supabase } from './supabase'
import type { CustoRecorrente } from './types'

type RegraProj = CustoRecorrente & { projetos: { status: string } | null }

/**
 * Lança como "realizado" as ocorrências já vencidas de cada custo recorrente ativo.
 * Roda ao abrir o app (não há servidor agendando). É idempotente: o índice único
 * (recorrente_id, data) ignora ocorrências já lançadas. Projetos concluídos ou
 * cancelados são pulados (lançamentos ficam bloqueados nesses status).
 * Retorna quantos custos foram criados.
 */
export async function gerarCustosRecorrentes(usuarioId?: string): Promise<number> {
  const regras = ok(await supabase.from('custos_recorrentes').select('*, projetos(status)').eq('ativo', true)) as unknown as RegraProj[]
  const ate = hoje()
  let criados = 0

  for (const r of regras) {
    if (r.projetos && ['concluido', 'cancelado'].includes(r.projetos.status)) continue
    const datas = ocorrenciasDe(r, r.ultima_geracao, ate)
    if (!datas.length) continue

    const linhas = datas.map((data) => ({
      projeto_id: r.projeto_id, tarefa_id: r.tarefa_id, usuario_id: usuarioId ?? null, data,
      descricao: r.descricao, categoria: r.categoria, valor: r.valor, fornecedor: r.fornecedor,
      situacao: 'realizado', repassar_cliente: r.repassar_cliente, recorrente_id: r.id,
    }))
    const inseridos = ok(
      await supabase.from('custos').upsert(linhas, { onConflict: 'recorrente_id,data', ignoreDuplicates: true }).select('id'),
    ) as { id: string }[]
    criados += inseridos.length
    ok(await supabase.from('custos_recorrentes').update({ ultima_geracao: datas[datas.length - 1] }).eq('id', r.id))
  }
  return criados
}
