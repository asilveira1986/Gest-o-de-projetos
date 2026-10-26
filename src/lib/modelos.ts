import { diasEntre, somarDias } from './calc'
import { ok, supabase } from './supabase'
import type { Custo, CustoRecorrente, Prioridade, Projeto, Subtarefa, Tarefa } from './types'

/**
 * Modelo = estrutura reaproveitável de um projeto. Datas viram "deslocamentos em dias"
 * a partir do início, para valerem em qualquer projeto novo. Não leva horas, custos
 * lançados, comentários, anexos, responsáveis nem status das tarefas.
 */
export interface ModeloDados {
  projeto: {
    descricao: string | null
    orcamento: number
    tipo_cobranca: 'hora' | 'fixo'
    valor_fixo: number | null
    valor_hora_venda: number | null
    duracao_dias: number | null
  }
  tarefas: {
    titulo: string
    descricao: string | null
    prioridade: Prioridade
    horas_estimadas: number
    prazo_dias: number | null
    subtarefas: string[]
  }[]
  recorrentes: {
    descricao: string
    categoria: string
    valor: number
    fornecedor: string | null
    repassar_cliente: boolean
    frequencia: CustoRecorrente['frequencia']
    dia_mes: number | null
  }[]
}

export interface Modelo {
  id: string
  nome: string
  descricao: string | null
  dados: ModeloDados
  criado_em: string
}

const deslocamento = (inicio: string | null, data: string | null) => (inicio && data ? diasEntre(inicio, data) : null)

export function extrairModelo(
  projeto: Pick<Projeto, 'descricao' | 'orcamento' | 'tipo_cobranca' | 'valor_fixo' | 'valor_hora_venda' | 'data_inicio' | 'prazo'>,
  tarefas: Tarefa[],
  subtarefas: Pick<Subtarefa, 'tarefa_id' | 'titulo'>[],
  recorrentes: CustoRecorrente[],
): ModeloDados {
  return {
    projeto: {
      descricao: projeto.descricao, orcamento: projeto.orcamento, tipo_cobranca: projeto.tipo_cobranca,
      valor_fixo: projeto.valor_fixo, valor_hora_venda: projeto.valor_hora_venda,
      duracao_dias: deslocamento(projeto.data_inicio, projeto.prazo),
    },
    tarefas: [...tarefas].sort((a, b) => a.ordem - b.ordem).map((t) => ({
      titulo: t.titulo, descricao: t.descricao, prioridade: t.prioridade, horas_estimadas: t.horas_estimadas,
      prazo_dias: deslocamento(projeto.data_inicio, t.prazo),
      subtarefas: subtarefas.filter((s) => s.tarefa_id === t.id).map((s) => s.titulo),
    })),
    recorrentes: recorrentes.map((r) => ({
      descricao: r.descricao, categoria: r.categoria, valor: r.valor, fornecedor: r.fornecedor,
      repassar_cliente: r.repassar_cliente, frequencia: r.frequencia, dia_mes: r.dia_mes,
    })),
  }
}

/** Datas concretas de um projeto novo a partir do modelo e da data de início. */
export function aplicarModelo(m: ModeloDados, inicio: string) {
  const somar = (dias: number | null) => (dias == null ? null : somarDias(inicio, dias))
  return {
    prazo: somar(m.projeto.duracao_dias),
    tarefas: m.tarefas.map((t) => ({ ...t, prazo: somar(t.prazo_dias) })),
    recorrentes: m.recorrentes.map((r) => ({ ...r, inicio })),
  }
}

/** Salva a estrutura do projeto como modelo. */
export async function salvarComoModelo(projetoId: string, nome: string, descricao: string | null) {
  const [p, t, s, r] = await Promise.all([
    supabase.from('projetos').select('*').eq('id', projetoId).single(),
    supabase.from('tarefas').select('*').eq('projeto_id', projetoId),
    supabase.from('subtarefas').select('tarefa_id,titulo,tarefas!inner(projeto_id)').eq('tarefas.projeto_id', projetoId),
    supabase.from('custos_recorrentes').select('*').eq('projeto_id', projetoId),
  ])
  const dados = extrairModelo(ok(p) as Projeto, ok(t) as Tarefa[], ok(s) as unknown as Subtarefa[], ok(r) as CustoRecorrente[])
  ok(await supabase.from('modelos_projeto').insert({ nome, descricao, dados }))
  return dados
}

/** Cria projeto, tarefas, checklists e custos recorrentes a partir de um modelo. */
export async function criarProjetoDeModelo(
  modelo: Modelo,
  args: { nome: string; cliente_id: string | null; inicio: string; responsavel_id: string | null },
): Promise<string> {
  const plano = aplicarModelo(modelo.dados, args.inicio)
  const projetoId = crypto.randomUUID()
  ok(await supabase.from('projetos').insert({
    id: projetoId, nome: args.nome, cliente_id: args.cliente_id, descricao: modelo.dados.projeto.descricao,
    data_inicio: args.inicio, prazo: plano.prazo, orcamento: modelo.dados.projeto.orcamento,
    tipo_cobranca: modelo.dados.projeto.tipo_cobranca, valor_fixo: modelo.dados.projeto.valor_fixo,
    valor_hora_venda: modelo.dados.projeto.valor_hora_venda, status: 'planejado', responsavel_id: args.responsavel_id,
  }))
  if (args.responsavel_id) ok(await supabase.from('projeto_membros').insert({ projeto_id: projetoId, usuario_id: args.responsavel_id }))

  // ids gerados aqui para ligar as subtarefas sem depender da ordem de retorno
  const tarefas = plano.tarefas.map((t, i) => ({ ...t, id: crypto.randomUUID(), ordem: i + 1 }))
  if (tarefas.length) {
    ok(await supabase.from('tarefas').insert(tarefas.map((t) => ({
      id: t.id, projeto_id: projetoId, titulo: t.titulo, descricao: t.descricao, prioridade: t.prioridade,
      horas_estimadas: t.horas_estimadas, prazo: t.prazo, status: 'a_fazer', ordem: t.ordem,
    }))))
    const subs = tarefas.flatMap((t) => t.subtarefas.map((titulo) => ({ tarefa_id: t.id, titulo })))
    if (subs.length) ok(await supabase.from('subtarefas').insert(subs))
  }
  if (plano.recorrentes.length) {
    ok(await supabase.from('custos_recorrentes').insert(plano.recorrentes.map((r) => ({ ...r, projeto_id: projetoId }))))
  }
  return projetoId
}

export type { Custo }
