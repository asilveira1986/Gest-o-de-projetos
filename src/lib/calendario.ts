import { somarDias } from './calc'

/** Grade de um mês (semanas começando na segunda), com as datas yyyy-mm-dd. */
export function gradeDoMes(ano: number, mes: number): string[][] {
  const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dow = new Date(`${primeiro}T12:00:00Z`).getUTCDay() // 0 = domingo
  const inicio = somarDias(primeiro, -((dow + 6) % 7))
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
  const semanas: string[][] = []
  for (let d = inicio; d <= fimMes || semanas.length < 4; d = somarDias(d, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(d, i)))
    if (semanas[semanas.length - 1][6] >= fimMes) break
  }
  return semanas
}

export const mesAnterior = (ano: number, mes: number) => (mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 })
export const proximoMes = (ano: number, mes: number) => (mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 })

export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
