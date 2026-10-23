import { useState } from 'react'
import { fmtHoras } from '../lib/format'
import { horasNoDia, parar, segundos, type Ativo } from '../lib/timer'
import { excedeLimiteDia } from '../lib/calc'
import { Erro, Modal } from './ui'
import { avisarTimer } from './TimerBar'

/** "Parar": pede descrição opcional e grava o lançamento. */
export function PararModal({ ativo, onClose, onSalvo }: { ativo: Ativo; onClose: () => void; onSalvo?: () => void }) {
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const horas = segundos(ativo) / 3600

  async function confirmar() {
    setSalvando(true)
    try {
      const jaNoDia = await horasNoDia(ativo.usuario_id, ativo.data, ativo.id)
      if (excedeLimiteDia(jaNoDia, horas) && !confirm('Este lançamento leva o dia a mais de 12 h. Confirmar mesmo assim?')) {
        setSalvando(false)
        return
      }
      await parar(ativo.id, descricao.trim() || null)
      avisarTimer()
      onSalvo?.()
      onClose()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Parar cronômetro" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm">
          Tempo trabalhado: <strong>{fmtHoras(horas)}</strong>
        </p>
        <textarea
          className="input"
          rows={3}
          autoFocus
          placeholder="O que foi feito? (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <Erro msg={erro} />
        <button className="btn-primary w-full" disabled={salvando} onClick={confirmar}>
          Salvar lançamento
        </button>
      </div>
    </Modal>
  )
}
