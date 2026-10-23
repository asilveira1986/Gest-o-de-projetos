import { somarDias } from './calc'

export type Frequencia = 'semanal' | 'mensal' | 'anual'

export interface Regra {
  frequencia: Frequencia
  inicio: string
  fim: string | null
  /** dia do mês (frequência mensal); meses curtos usam o último dia */
  dia_mes: number | null
}

const MAX_OCORRENCIAS = 60

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate() // mes: 1–12
const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimoDiaDoMes(ano, mes))).padStart(2, '0')}`

/**
 * Datas de ocorrência de uma regra, em ordem, estritamente depois de `depois`
 * (null = desde o início) e até `ate` (inclusive), respeitando `fim`.
 * Limitado a 60 por chamada para não inundar o lançamento após uma longa ausência.
 */
export function ocorrenciasDe(regra: Regra, depois: string | null, ate: string): string[] {
  const limite = regra.fim && regra.fim < ate ? regra.fim : ate
  const valida = (d: string) => d >= regra.inicio && d <= limite && (!depois || d > depois)
  const saida: string[] = []

  if (regra.frequencia === 'semanal') {
    for (let d = regra.inicio; d <= limite && saida.length < MAX_OCORRENCIAS; d = somarDias(d, 7)) {
      if (valida(d)) saida.push(d)
    }
    return saida
  }

  let ano = Number(regra.inicio.slice(0, 4))
  let mes = Number(regra.inicio.slice(5, 7))
  const dia = regra.frequencia === 'mensal' ? regra.dia_mes ?? Number(regra.inicio.slice(8, 10)) : Number(regra.inicio.slice(8, 10))
  const passo = regra.frequencia === 'mensal' ? 1 : 12
  for (;;) {
    const d = iso(ano, regra.frequencia === 'anual' ? Number(regra.inicio.slice(5, 7)) : mes, dia)
    if (d > limite || saida.length >= MAX_OCORRENCIAS) break
    if (valida(d)) saida.push(d)
    mes += passo
    while (mes > 12) { mes -= 12; ano += 1 }
  }
  return saida
}

/** Próxima ocorrência depois de `depois` (para mostrar "próximo lançamento"). */
export function proximaOcorrencia(regra: Regra, depois: string): string | null {
  const horizonte = somarDias(depois, 400)
  return ocorrenciasDe(regra, depois, horizonte)[0] ?? null
}

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = { semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' }
