import type { Previsao } from '../lib/calc'
import { brl, fmtData } from '../lib/format'

/** Frase de previsão de estouro; só aparece quando há motivo para atenção. */
export function textoPrevisao(p: Previsao | null): { texto: string; grave: boolean } | null {
  if (!p || p.estourado) return null
  if (p.dias == null || p.data == null) return null
  if (!p.antesDoPrazo || p.dias <= 14) {
    return {
      grave: !p.antesDoPrazo && p.dias <= 14,
      texto: `No ritmo atual (${brl(p.ritmoDia)}/dia) o orçamento acaba em ${p.dias} dia(s), por volta de ${fmtData(p.data)}${p.antesDoPrazo ? '' : ', antes do prazo'}.`,
    }
  }
  return null
}

export function AvisoPrevisao({ previsao }: { previsao: Previsao | null }) {
  const t = textoPrevisao(previsao)
  if (!t) return null
  return (
    <p className={`rounded-lg px-3 py-2 text-xs ${t.grave ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>⏳ {t.texto}</p>
  )
}
