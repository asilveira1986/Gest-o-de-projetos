import { describe, expect, it } from 'vitest'
import {
  alertaOrcamento, custoProjetado, custoTotal, excedeLimiteDia, horasDosIntervalos, margem,
  pausaExpirada, pctConsumido, progresso, receita, saldo, tarefaAtrasada, valorVendaEfetivo,
} from './calc'
import { fmtData, fmtHoras, fmtRelogio, parseHoras } from './format'
import type { Custo, LancamentoHoras } from './types'

const h = (horas: number, custo: number, venda: number, faturavel = true) =>
  ({ horas, valor_hora_aplicado: custo, valor_venda_aplicado: venda, faturavel }) as LancamentoHoras
const c = (valor: number, situacao: Custo['situacao'], repassar = false) =>
  ({ valor, situacao, repassar_cliente: repassar }) as Custo

describe('cálculos do projeto', () => {
  const horas = [h(10, 50, 120), h(5, 80, 120, false)]
  const custos = [c(300, 'realizado', true), c(200, 'previsto'), c(100, 'realizado')]

  it('custo total soma mão de obra e custos realizados', () => {
    expect(custoTotal(horas, custos)).toBe(10 * 50 + 5 * 80 + 400)
  })
  it('custo projetado inclui previstos', () => {
    expect(custoProjetado(horas, custos)).toBe(1300 + 200)
  })
  it('receita = horas faturáveis × venda + custos repassados', () => {
    expect(receita(horas, custos)).toBe(10 * 120 + 300)
    expect(margem(receita(horas, custos), custoTotal(horas, custos))).toBe(1500 - 1300)
  })
  it('saldo e % consumido', () => {
    expect(saldo(2000, 1300)).toBe(700)
    expect(pctConsumido(2000, 1300)).toBe(65)
    expect(pctConsumido(0, 100)).toBe(0)
  })
})

describe('alertas e regras', () => {
  it('limiares de orçamento', () => {
    expect(alertaOrcamento(79.9)).toBe('ok')
    expect(alertaOrcamento(80)).toBe('amarelo')
    expect(alertaOrcamento(100)).toBe('amarelo')
    expect(alertaOrcamento(100.1)).toBe('vermelho')
  })
  it('progresso ignora subtarefas', () => {
    expect(progresso([{ status: 'concluida' }, { status: 'a_fazer' }])).toBe(50)
    expect(progresso([])).toBe(0)
  })
  it('tarefa atrasada', () => {
    expect(tarefaAtrasada({ prazo: '2026-10-01', status: 'a_fazer' }, '2026-10-23')).toBe(true)
    expect(tarefaAtrasada({ prazo: '2026-10-01', status: 'concluida' }, '2026-10-23')).toBe(false)
    expect(tarefaAtrasada({ prazo: null, status: 'a_fazer' }, '2026-10-23')).toBe(false)
  })
  it('limite de 12 h por dia', () => {
    expect(excedeLimiteDia(10, 2)).toBe(false)
    expect(excedeLimiteDia(10, 2.5)).toBe(true)
  })
  it('pausa expira após 8 h', () => {
    const agora = new Date('2026-10-23T20:00:00Z')
    expect(pausaExpirada('2026-10-23T12:30:00Z', agora)).toBe(false) // 7,5 h
    expect(pausaExpirada('2026-10-23T11:59:00Z', agora)).toBe(true)
  })
  it('valor de venda herda do cliente', () => {
    expect(valorVendaEfetivo({ valor_hora_venda: null }, { valor_hora_venda_padrao: 150 })).toBe(150)
    expect(valorVendaEfetivo({ valor_hora_venda: 200 }, { valor_hora_venda_padrao: 150 })).toBe(200)
    expect(valorVendaEfetivo({ valor_hora_venda: null }, null)).toBe(0)
  })
})

describe('intervalos do cronômetro', () => {
  it('soma só os trechos contados (pausas não contam)', () => {
    const v = horasDosIntervalos([
      { id: '1', lancamento_id: 'x', inicio: '2026-10-23T09:00:00Z', fim: '2026-10-23T11:00:00Z' },
      { id: '2', lancamento_id: 'x', inicio: '2026-10-23T12:00:00Z', fim: '2026-10-23T12:30:00Z' },
    ])
    expect(v).toBe(2.5)
  })
  it('intervalo aberto conta até agora', () => {
    const v = horasDosIntervalos(
      [{ id: '1', lancamento_id: 'x', inicio: '2026-10-23T09:00:00Z', fim: null }],
      new Date('2026-10-23T10:30:00Z'),
    )
    expect(v).toBe(1.5)
  })
})

describe('formatação', () => {
  it('formata data, horas e relógio', () => {
    expect(fmtData('2026-10-23')).toBe('23/10/2026')
    expect(fmtHoras(2.5)).toBe('2h 30min')
    expect(fmtRelogio(3725)).toBe('01:02:05')
  })
  it('interpreta horas digitadas', () => {
    expect(parseHoras('1,5')).toBe(1.5)
    expect(parseHoras('1:30')).toBe(1.5)
    expect(parseHoras('')).toBeNaN()
  })
})
