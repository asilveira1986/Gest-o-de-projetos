import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { brl, fmtData, fmtHoras } from './format'
import type { Cliente, Fatura } from './types'

export interface ItemHoras {
  projeto: string
  tarefa: string
  horas: number
  valor_venda_aplicado: number
}
export interface ItemCusto {
  descricao: string
  valor: number
}

/** PDF da fatura. Só valores de venda: custo interno e margem não entram. */
export function gerarFaturaPdf(args: {
  fatura: Fatura
  cliente: Cliente | null
  empresa: { nome: string | null; logo: string | null; pagamento: string | null }
  horas: ItemHoras[]
  custos: ItemCusto[]
}) {
  const { fatura, cliente, empresa, horas, custos } = args
  const doc = new jsPDF()
  if (empresa.logo) {
    try { doc.addImage(empresa.logo, empresa.logo.includes('image/png') ? 'PNG' : 'JPEG', 14, 10, 30, 15) } catch { /* logo inválida: ignora */ }
  }
  doc.setFontSize(18)
  doc.text('FATURA', 196, 18, { align: 'right' })
  doc.setFontSize(10)
  doc.text(`Nº ${fatura.id.slice(0, 8).toUpperCase()}`, 196, 24, { align: 'right' })
  if (empresa.nome) doc.text(empresa.nome, 196, 30, { align: 'right' })

  let y = 38
  doc.setFontSize(11)
  doc.text('Cliente', 14, y)
  doc.setFontSize(10)
  doc.text([cliente?.nome ?? '—', ...(cliente?.documento ? [`CPF/CNPJ: ${cliente.documento}`] : []), ...(cliente?.email ? [cliente.email] : [])], 14, (y += 5))
  doc.text([`Emissão: ${fmtData(fatura.emitida_em)}`, `Vencimento: ${fmtData(fatura.vencimento)}`], 196, y, { align: 'right' })
  y += 22

  const linhas: (string | number)[][] = []
  const agrupado = new Map<string, { projeto: string; tarefa: string; horas: number; valor: number }>()
  for (const h of horas) {
    const k = `${h.projeto}|${h.tarefa}`
    const g = agrupado.get(k) ?? { projeto: h.projeto, tarefa: h.tarefa, horas: 0, valor: 0 }
    g.horas += h.horas
    g.valor += h.horas * h.valor_venda_aplicado
    agrupado.set(k, g)
  }
  agrupado.forEach((g) => linhas.push([`${g.projeto} — ${g.tarefa}`, fmtHoras(g.horas), brl(g.valor)]))
  custos.forEach((c) => linhas.push([`Repasse: ${c.descricao}`, '—', brl(c.valor)]))
  // fatura avulsa (sem itens ligados): uma linha com a descrição
  if (!linhas.length) linhas.push([fatura.descricao || 'Serviços prestados', '—', brl(fatura.valor)])

  autoTable(doc, { startY: y, head: [['Descrição', 'Horas', 'Valor']], body: linhas.map((l) => l.map(String)), styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.text(`Total: ${brl(fatura.valor)}`, 196, y, { align: 'right' })
  if (fatura.nfse_status === 'emitida' && fatura.nfse_numero) {
    doc.setFontSize(10)
    doc.text(`NFS-e nº ${fatura.nfse_numero}${fatura.nfse_emitida_em ? ` de ${fmtData(fatura.nfse_emitida_em)}` : ''}`, 196, y + 6, { align: 'right' })
  }

  if (fatura.descricao && linhas.length > 1) {
    doc.setFontSize(10)
    doc.text(fatura.descricao, 14, y)
  }
  if (empresa.pagamento) {
    doc.setFontSize(11)
    doc.text('Dados para pagamento', 14, (y += 14))
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(empresa.pagamento, 180), 14, y + 6)
  }
  doc.save(`fatura-${fatura.id.slice(0, 8)}.pdf`)
}
