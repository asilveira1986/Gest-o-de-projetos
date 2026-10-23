import { alertaOrcamento, custoProjetado, previsaoEstouro, type Previsao, custoTotal, margem, pctConsumido, progresso, receita, saldo, tarefaAtrasada } from './calc'
import { hoje } from './format'
import { ok, supabase } from './supabase'
import type { Custo, LancamentoHoras, Projeto, Tarefa } from './types'

export type LancComTarefa = LancamentoHoras & { tarefas: { id: string; titulo: string; projeto_id: string } }

export interface Resumo {
  projeto: Projeto
  tarefas: Tarefa[]
  horas: LancComTarefa[]
  custos: Custo[]
  totalHoras: number
  horasEstimadas: number
  custo: number
  projetado: number
  saldo: number
  pct: number
  alerta: ReturnType<typeof alertaOrcamento>
  receita: number
  margem: number
  progresso: number
  atrasadas: number
  previsao: Previsao | null
}

export function montarResumo(p: Projeto, tarefas: Tarefa[], horas: LancComTarefa[], custos: Custo[]): Resumo {
  const custo = custoTotal(horas, custos)
  const pct = pctConsumido(p.orcamento, custo)
  const rec = receita(horas, custos, p)
  const h = hoje()
  return {
    projeto: p,
    tarefas,
    horas,
    custos,
    totalHoras: horas.reduce((s, x) => s + Number(x.horas), 0),
    horasEstimadas: tarefas.reduce((s, t) => s + Number(t.horas_estimadas), 0),
    custo,
    projetado: custoProjetado(horas, custos),
    saldo: saldo(p.orcamento, custo),
    pct,
    alerta: alertaOrcamento(pct),
    receita: rec,
    margem: margem(rec, custo),
    progresso: progresso(tarefas),
    atrasadas: tarefas.filter((t) => tarefaAtrasada(t, h)).length,
    previsao: ['concluido', 'cancelado'].includes(p.status) ? null : previsaoEstouro(horas, custos, p.orcamento, p.prazo, h),
  }
}

/** Carrega todos os projetos (não arquivados por padrão) com seus números. */
export async function carregarResumos(incluirArquivados = false): Promise<Resumo[]> {
  let q = supabase.from('projetos').select('*, clientes(*)').order('nome')
  if (!incluirArquivados) q = q.eq('arquivado', false)
  const projetos = ok(await q) as Projeto[]
  const ids = projetos.map((p) => p.id)
  if (!ids.length) return []
  const [t, h, c] = await Promise.all([
    supabase.from('tarefas').select('*').in('projeto_id', ids),
    supabase.from('lancamentos_horas').select('*, tarefas!inner(id,titulo,projeto_id)').in('tarefas.projeto_id', ids),
    supabase.from('custos').select('*').in('projeto_id', ids),
  ])
  const tarefas = ok(t) as Tarefa[]
  const horas = ok(h) as unknown as LancComTarefa[]
  const custos = ok(c) as Custo[]
  return projetos.map((p) =>
    montarResumo(
      p,
      tarefas.filter((x) => x.projeto_id === p.id),
      horas.filter((x) => x.tarefas.projeto_id === p.id),
      custos.filter((x) => x.projeto_id === p.id),
    ),
  )
}
