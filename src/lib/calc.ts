import type { Custo, Fatura, Intervalo, LancamentoHoras, Projeto, Tarefa } from './types'

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

/**
 * Receita = Σ(horas faturáveis × valor_venda_aplicado) + Σ custos repassados.
 * Em projeto de valor fixo, as horas não geram receita: vale o valor fechado.
 */
export function receita(l: LancamentoHoras[], c: Custo[], projeto?: Pick<Projeto, 'tipo_cobranca' | 'valor_fixo'>) {
  const base =
    projeto?.tipo_cobranca === 'fixo'
      ? projeto.valor_fixo ?? 0
      : l.filter((x) => x.faturavel).reduce((s, x) => s + x.horas * x.valor_venda_aplicado, 0)
  const repasse = c
    .filter((x) => x.repassar_cliente && x.situacao === 'realizado')
    .reduce((s, x) => s + x.valor, 0)
  return base + repasse
}

/** Receita efetiva por hora trabalhada (mostra se um projeto fixo compensa). */
export const receitaPorHora = (rec: number, horas: number) => (horas > 0 ? rec / horas : 0)

export type StatusFatura = 'paga' | 'vencida' | 'aberta'

/** Paga se tem data de pagamento; vencida se passou do vencimento sem pagar. */
export function statusFatura(f: Pick<Fatura, 'pago_em' | 'vencimento'>, hoje: string): StatusFatura {
  if (f.pago_em) return 'paga'
  return f.vencimento < hoje ? 'vencida' : 'aberta'
}

/** Soma `dias` a uma data yyyy-mm-dd (sem depender de fuso). */
export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
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

/** Dias corridos entre duas datas yyyy-mm-dd (b − a). */
export const diasEntre = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)

/** Segunda-feira da semana de `data` (yyyy-mm-dd). */
export function inicioSemana(data: string) {
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay() // 0 = domingo
  return somarDias(data, -((dia + 6) % 7))
}

export interface Previsao {
  /** orçamento já consumido por completo */
  estourado: boolean
  /** dias até esgotar o orçamento no ritmo atual (null = sem ritmo) */
  dias: number | null
  /** data estimada do estouro */
  data: string | null
  /** gasto médio por dia usado na estimativa */
  ritmoDia: number
  /** o estouro previsto vem antes do prazo do projeto */
  antesDoPrazo: boolean
}

const JANELA_RITMO = 14
const JANELA_MIN = 3

/**
 * Previsão de estouro: ritmo = gasto (mão de obra + custos realizados) dos últimos
 * 14 dias ÷ dias da janela; dias restantes = saldo ÷ ritmo.
 * Se o histórico for mais curto que 14 dias, usa os dias existentes (mín. 3)
 * para não subestimar nem inflar o ritmo.
 */
export function previsaoEstouro(
  horas: Pick<LancamentoHoras, 'data' | 'horas' | 'valor_hora_aplicado'>[],
  custos: Pick<Custo, 'data' | 'valor' | 'situacao'>[],
  orcamento: number,
  prazo: string | null,
  hoje: string,
): Previsao | null {
  if (orcamento <= 0) return null
  const gastos = [
    ...horas.map((h) => ({ data: h.data, v: h.horas * h.valor_hora_aplicado })),
    ...custos.filter((c) => c.situacao === 'realizado').map((c) => ({ data: c.data, v: c.valor })),
  ]
  if (!gastos.length) return null
  const total = gastos.reduce((s, g) => s + g.v, 0)
  if (total >= orcamento) return { estourado: true, dias: 0, data: hoje, ritmoDia: 0, antesDoPrazo: true }

  const primeiro = gastos.reduce((m, g) => (g.data < m ? g.data : m), gastos[0].data)
  const janela = Math.min(JANELA_RITMO, Math.max(JANELA_MIN, diasEntre(primeiro, hoje) + 1))
  const desde = somarDias(hoje, -(janela - 1))
  const recente = gastos.filter((g) => g.data >= desde && g.data <= hoje).reduce((s, g) => s + g.v, 0)
  const ritmoDia = recente / janela
  if (ritmoDia <= 0) return { estourado: false, dias: null, data: null, ritmoDia: 0, antesDoPrazo: false }

  const dias = Math.ceil((orcamento - total) / ritmoDia)
  const data = somarDias(hoje, dias)
  return { estourado: false, dias, data, ritmoDia, antesDoPrazo: !prazo || data <= prazo }
}
