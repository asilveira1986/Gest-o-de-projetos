import { describe, expect, it } from 'vitest'
import {
  alertaOrcamento, custoProjetado, diasEntre, inicioSemana, previsaoEstouro, custoTotal, excedeLimiteDia, horasDosIntervalos, margem,
  pausaExpirada, pctConsumido, progresso, receita, receitaPorHora, saldo, somarDias, statusFatura, tarefaAtrasada, valorVendaEfetivo,
} from './calc'
import { linhaParaExcel, LIMITE_CELULA } from './backup'
import { aplicarModelo, extrairModelo } from './modelos'
import { gradeDoMes, mesAnterior, proximoMes } from './calendario'
import { ocorrenciasDe, proximaOcorrencia } from './recorrencia'
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

describe('projeto de valor fixo e recebimentos', () => {
  const fixo = { tipo_cobranca: 'fixo' as const, valor_fixo: 5000 }
  it('receita fixa ignora horas e soma repasses', () => {
    expect(receita([h(10, 50, 120)], [c(300, 'realizado', true)], fixo)).toBe(5300)
  })
  it('receita por hora efetiva', () => {
    expect(receitaPorHora(5000, 20)).toBe(250)
    expect(receitaPorHora(5000, 0)).toBe(0)
  })
  it('status da fatura', () => {
    expect(statusFatura({ pago_em: '2026-10-01', vencimento: '2026-09-01' }, '2026-10-23')).toBe('paga')
    expect(statusFatura({ pago_em: null, vencimento: '2026-10-22' }, '2026-10-23')).toBe('vencida')
    expect(statusFatura({ pago_em: null, vencimento: '2026-10-23' }, '2026-10-23')).toBe('aberta')
  })
  it('soma dias', () => {
    expect(somarDias('2026-10-23', 15)).toBe('2026-11-07')
    expect(somarDias('2026-12-25', 10)).toBe('2027-01-04')
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

describe('previsão de estouro', () => {
  const dia = (data: string, horas: number) => ({ data, horas, valor_hora_aplicado: 100 })
  it('calcula dias até esgotar o orçamento no ritmo recente', () => {
    // 7 dias seguidos de R$ 200 = R$ 1.400; janela de 7 dias → ritmo 200/dia
    const horas = ['16', '17', '18', '19', '20', '21', '22'].map((d) => dia(`2026-10-${d}`, 2))
    const p = previsaoEstouro(horas, [], 2000, null, '2026-10-22')!
    expect(p.ritmoDia).toBe(200)
    expect(p.dias).toBe(3) // saldo 600 ÷ 200
    expect(p.data).toBe('2026-10-25')
  })
  it('avisa quando o estouro vem antes do prazo', () => {
    const horas = ['20', '21', '22'].map((d) => dia(`2026-10-${d}`, 2))
    expect(previsaoEstouro(horas, [], 2000, '2026-10-30', '2026-10-22')!.antesDoPrazo).toBe(true)
    expect(previsaoEstouro(horas, [], 100000, '2026-10-30', '2026-10-22')!.antesDoPrazo).toBe(false)
  })
  it('estourado, sem orçamento e sem lançamentos', () => {
    expect(previsaoEstouro([dia('2026-10-22', 30)], [], 2000, null, '2026-10-22')!.estourado).toBe(true)
    expect(previsaoEstouro([dia('2026-10-22', 1)], [], 0, null, '2026-10-22')).toBeNull()
    expect(previsaoEstouro([], [], 1000, null, '2026-10-22')).toBeNull()
  })
  it('só custos realizados entram no ritmo', () => {
    const p = previsaoEstouro([], [{ data: '2026-10-22', valor: 300, situacao: 'realizado' }, { data: '2026-10-22', valor: 9999, situacao: 'previsto' }], 1000, null, '2026-10-22')!
    expect(p.ritmoDia).toBe(100) // 300 ÷ janela mínima de 3 dias
  })
})

describe('datas', () => {
  it('dias entre e início da semana', () => {
    expect(diasEntre('2026-10-20', '2026-10-23')).toBe(3)
    expect(inicioSemana('2026-10-23')).toBe('2026-10-19') // sexta → segunda
    expect(inicioSemana('2026-10-25')).toBe('2026-10-19') // domingo
    expect(inicioSemana('2026-10-19')).toBe('2026-10-19')
  })
})

describe('recorrência de custos', () => {
  const mensal = { frequencia: 'mensal' as const, inicio: '2026-01-31', fim: null, dia_mes: 31 }
  it('mensal usa o último dia em meses curtos', () => {
    expect(ocorrenciasDe(mensal, null, '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('só gera depois da última geração e até hoje', () => {
    expect(ocorrenciasDe(mensal, '2026-02-28', '2026-03-30')).toEqual([])
    expect(ocorrenciasDe(mensal, '2026-02-28', '2026-03-31')).toEqual(['2026-03-31'])
  })
  it('respeita a data final', () => {
    const r = { frequencia: 'mensal' as const, inicio: '2026-01-10', fim: '2026-03-15', dia_mes: 10 }
    expect(ocorrenciasDe(r, null, '2026-12-31')).toEqual(['2026-01-10', '2026-02-10', '2026-03-10'])
  })
  it('semanal anda de 7 em 7 dias', () => {
    const r = { frequencia: 'semanal' as const, inicio: '2026-10-01', fim: null, dia_mes: null }
    expect(ocorrenciasDe(r, null, '2026-10-22')).toEqual(['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'])
  })
  it('anual repete mês e dia (29/02 cai em 28/02 em ano comum)', () => {
    const r = { frequencia: 'anual' as const, inicio: '2024-02-29', fim: null, dia_mes: null }
    expect(ocorrenciasDe(r, null, '2026-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28'])
  })
  it('não gera antes do início e limita a 60 por vez', () => {
    expect(ocorrenciasDe({ ...mensal, inicio: '2026-11-05', dia_mes: 5 }, null, '2026-10-23')).toEqual([])
    const diario = { frequencia: 'semanal' as const, inicio: '2000-01-01', fim: null, dia_mes: null }
    expect(ocorrenciasDe(diario, null, '2026-10-23')).toHaveLength(60)
  })
  it('próxima ocorrência', () => {
    expect(proximaOcorrencia({ frequencia: 'mensal', inicio: '2026-01-10', fim: null, dia_mes: 10 }, '2026-10-23')).toBe('2026-11-10')
    expect(proximaOcorrencia({ frequencia: 'mensal', inicio: '2026-01-10', fim: '2026-10-31', dia_mes: 10 }, '2026-10-23')).toBeNull()
  })
})

describe('grade do calendário', () => {
  it('outubro/2026 começa na segunda 28/09 e termina no domingo 01/11', () => {
    const g = gradeDoMes(2026, 10)
    expect(g[0][0]).toBe('2026-09-28')
    expect(g[g.length - 1][6]).toBe('2026-11-01')
    expect(g.every((sem) => sem.length === 7)).toBe(true)
  })
  it('fevereiro de 2027 (começa na segunda) cabe em 4 semanas', () => {
    const g = gradeDoMes(2027, 2)
    expect(g).toHaveLength(4)
    expect(g[0][0]).toBe('2027-02-01')
  })
  it('navega entre meses na virada do ano', () => {
    expect(mesAnterior(2026, 1)).toEqual({ ano: 2025, mes: 12 })
    expect(proximoMes(2026, 12)).toEqual({ ano: 2027, mes: 1 })
  })
})

describe('modelos de projeto', () => {
  const projeto = { descricao: 'Site institucional', orcamento: 8000, tipo_cobranca: 'hora' as const, valor_fixo: null, valor_hora_venda: 150, data_inicio: '2026-01-05', prazo: '2026-02-04' }
  const tarefas = [
    { id: 'b', titulo: 'Desenvolvimento', descricao: null, prioridade: 'media', horas_estimadas: 20, prazo: '2026-01-25', ordem: 2, status: 'concluida', responsavel_id: 'u1' },
    { id: 'a', titulo: 'Briefing', descricao: 'Reunião', prioridade: 'alta', horas_estimadas: 2, prazo: '2026-01-08', ordem: 1, status: 'em_andamento', responsavel_id: 'u1' },
    { id: 'c', titulo: 'Sem prazo', descricao: null, prioridade: 'baixa', horas_estimadas: 0, prazo: null, ordem: 3, status: 'a_fazer', responsavel_id: null },
  ] as never
  const subs = [{ tarefa_id: 'a', titulo: 'Coletar logo' }, { tarefa_id: 'a', titulo: 'Definir escopo' }, { tarefa_id: 'b', titulo: 'Deploy' }]
  const rec = [{ descricao: 'Hospedagem', categoria: 'Software/Licença', valor: 50, fornecedor: null, repassar_cliente: true, frequencia: 'mensal', dia_mes: 10, inicio: '2026-01-10' }] as never

  const m = extrairModelo(projeto, tarefas, subs, rec)
  it('extrai estrutura ordenada, com deslocamentos em dias e sem estado', () => {
    expect(m.tarefas.map((t) => t.titulo)).toEqual(['Briefing', 'Desenvolvimento', 'Sem prazo'])
    expect(m.tarefas.map((t) => t.prazo_dias)).toEqual([3, 20, null])
    expect(m.projeto.duracao_dias).toBe(30)
    expect(m.tarefas[0].subtarefas).toEqual(['Coletar logo', 'Definir escopo'])
    expect(JSON.stringify(m)).not.toContain('responsavel')
    expect(m.recorrentes[0]).not.toHaveProperty('inicio')
  })
  it('aplica a nova data de início a prazos e recorrências', () => {
    const plano = aplicarModelo(m, '2026-11-02')
    expect(plano.prazo).toBe('2026-12-02')
    expect(plano.tarefas.map((t) => t.prazo)).toEqual(['2026-11-05', '2026-11-22', null])
    expect(plano.recorrentes[0].inicio).toBe('2026-11-02')
  })
  it('projeto sem datas gera modelo sem prazos', () => {
    const sem = extrairModelo({ ...projeto, data_inicio: null, prazo: null }, tarefas, [], [])
    expect(sem.projeto.duracao_dias).toBeNull()
    expect(aplicarModelo(sem, '2026-11-02').prazo).toBeNull()
  })
})

describe('backup para Excel', () => {
  it('mantém primitivos, serializa objetos e trunca células enormes', () => {
    const l = linhaParaExcel({ a: 1, b: 'x', c: null, d: true, e: { k: 1 }, logo: 'z'.repeat(LIMITE_CELULA + 10) })
    expect(l.a).toBe(1); expect(l.c).toBeNull(); expect(l.d).toBe(true)
    expect(l.e).toBe('{"k":1}')
    expect(String(l.logo)).toContain('veja o backup JSON')
    expect(String(l.logo).length).toBeLessThan(100)
  })
})
