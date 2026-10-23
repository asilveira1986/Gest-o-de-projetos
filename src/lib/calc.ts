import type { Custo, Intervalo, LancamentoHoras, Tarefa } from './types'

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Soma dos intervalos em horas. Intervalo aberto conta até `agora`. */
export function horasDosIntervalos(intervalos: Intervalo[], agora: Date = new Date()): number {
  const ms = intervalos.reduce((acc, i) => {
    const fim = i.fim ? new Date(i.fim) : agora
    return acc + Math.max(0, fim.getTime() - new Date(i.inicio).getTime())
  }, 0)
  return ms / 3_600_000
}

export const custoMaoDeObra = (l: Pick<LancamentoHoras, 'horas' | 'valor_hora_aplicado'>[]) =>
  l.reduce((s, x) => s + x.horas * x.valor_hora_aplicado, 0)

export const custosRealizados = (c: Pick<Custo, 'valor' | 'situacao'>[]) =>
  c.filter((x) => x.situacao === 'realizado').reduce((s, x) => s + x.valor, 0)

export const custosPrevistos = (c: Pick<Custo, 'valor' | 'situacao'>[]) =>
  c.filter((x) => x.situacao === 'previsto').reduce((s, x) => s + x.valor, 0)

/** Custo total = Σ(horas × valor_hora_aplicado) + Σ custos realizados */
export const custoTotal = (l: LancamentoHoras[], c: Custo[]) => custoMaoDeObra(l) + custosRealizados(c)

/** Custo projetado = custo total + custos previstos ainda não realizados */
export const custoProjetado = (l: LancamentoHoras[], c: Custo[]) => custoTotal(l, c) + custosPrevistos(c)

export const saldo = (orcamento: number, custo: number) => orcamento - custo

/** % consumido; sem orçamento definido não há consumo calculável (0). */
export const pctConsumido = (orcamento: number, custo: number) =>
  orcamento > 0 ? (custo / orcamento) * 100 : 0

export type AlertaOrcamento = 'ok' | 'amarelo' | 'vermelho'

/** Amarelo a partir de 80%, vermelho acima de 100%. */
export function alertaOrcamento(pct: number): AlertaOrcamento {
  if (pct > 100) return 'vermelho'
  if (pct >= 80) return 'amarelo'
  return 'ok'
}

/** Receita = Σ(horas faturáveis × valor_venda_aplicado) + Σ custos repassados */
export function receita(l: LancamentoHoras[], c: Custo[]) {
  const horas = l.filter((x) => x.faturavel).reduce((s, x) => s + x.horas * x.valor_venda_aplicado, 0)
  const repasse = c
    .filter((x) => x.repassar_cliente && x.situacao === 'realizado')
    .reduce((s, x) => s + x.valor, 0)
  return horas + repasse
}

export const margem = (rec: number, custo: number) => rec - custo

/** Progresso = concluídas ÷ total (subtarefas não contam). */
export function progresso(tarefas: Pick<Tarefa, 'status'>[]) {
  if (!tarefas.length) return 0
  return (tarefas.filter((t) => t.status === 'concluida').length / tarefas.length) * 100
}

/** Atrasada: prazo vencido e status ≠ Concluída. `hoje` em yyyy-mm-dd. */
export const tarefaAtrasada = (t: Pick<Tarefa, 'prazo' | 'status'>, hoje: string) =>
  !!t.prazo && t.prazo < hoje && t.status !== 'concluida'

export const LIMITE_HORAS_DIA = 12
export const PAUSA_MAX_HORAS = 8

/** Lançamento que leva o dia a passar de 12 h pede confirmação. */
export const excedeLimiteDia = (horasNoDia: number, novas: number) =>
  horasNoDia + novas > LIMITE_HORAS_DIA

/** Cronômetro pausado há mais de 8 h deve ser finalizado no último horário ativo. */
export function pausaExpirada(ultimoFim: string, agora: Date = new Date()) {
  return (agora.getTime() - new Date(ultimoFim).getTime()) / 3_600_000 > PAUSA_MAX_HORAS
}

/** Valor/hora de venda: o do projeto, senão o padrão do cliente, senão 0. */
export const valorVendaEfetivo = (
  projeto: { valor_hora_venda: number | null },
  cliente?: { valor_hora_venda_padrao: number } | null,
) => projeto.valor_hora_venda ?? cliente?.valor_hora_venda_padrao ?? 0
