export const TZ = 'America/Sao_Paulo'

export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Data (yyyy-mm-dd ou ISO) → dd/mm/aaaa */
export function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ })
}

export const fmtHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—'

/** Data de hoje (yyyy-mm-dd) no fuso de São Paulo */
export const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

/** Horas decimais → "2h 30min" */
export function fmtHoras(h: number): string {
  const total = Math.round((h || 0) * 60)
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${hh}h ${String(mm).padStart(2, '0')}min`
}

/** Segundos → "HH:MM:SS" */
export function fmtRelogio(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [h, m, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

export const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

/** Aceita "1,5", "1.5" ou "1:30" e devolve horas decimais (NaN se inválido) */
export function parseHoras(txt: string): number {
  const t = txt.trim()
  if (!t) return NaN
  if (t.includes(':')) {
    const [h, m] = t.split(':').map(Number)
    return h + (m || 0) / 60
  }
  return Number(t.replace(',', '.'))
}
