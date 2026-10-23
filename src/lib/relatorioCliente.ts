import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { brl, fmtData, fmtHoras } from './format'
import type { Cliente, Custo, Projeto } from './types'

export interface LinhaHoras {
  tarefa: string
  data: string
  horas: number
  valor_venda_aplicado: number
  descricao: string | null
}

export interface OpcoesCliente {
  incluirCustos: boolean
  mostrarDescricoes: boolean
}

/**
 * PDF para o cliente. Só usa valores de VENDA: custo interno (valor_hora_aplicado)
 * e margem não entram nesta função.
 */
export function gerarRelatorioCliente(args: {
  projeto: Projeto
  cliente: Cliente | null
  empresa: { nome: string | null; logo: string | null }
  de: string
  ate: string
  horas: LinhaHoras[]
  custos: Pick<Custo, 'data' | 'descricao' | 'valor'>[]
  tarefasConcluidas: string[]
  opcoes: OpcoesCliente
}) {
  const { projeto, cliente, empresa, de, ate, horas, custos, tarefasConcluidas, opcoes } = args
  const doc = new jsPDF()
  let y = 16
  if (empresa.logo) {
    try { doc.addImage(empresa.logo, empresa.logo.includes('image/png') ? 'PNG' : 'JPEG', 14, 10, 30, 15) } catch { /* logo inválida: ignora */ }
  }
  doc.setFontSize(16)
  doc.text('Relatório de serviços', 196, y, { align: 'right' })
  doc.setFontSize(10)
  if (empresa.nome) doc.text(empresa.nome, 196, y + 6, { align: 'right' })
  y = 34
  doc.setFontSize(11)
  doc.text(`Cliente: ${cliente?.nome ?? '—'}`, 14, y)
  if (cliente?.documento) doc.text(`CPF/CNPJ: ${cliente.documento}`, 14, (y += 6))
  doc.text(`Projeto: ${projeto.nome}`, 14, (y += 6))
  doc.text(`Período: ${fmtData(de)} a ${fmtData(ate)}`, 14, (y += 6))
  y += 8

  if (tarefasConcluidas.length) {
    doc.setFontSize(12)
    doc.text('Tarefas realizadas', 14, y)
    autoTable(doc, { startY: y + 3, head: [['Tarefa']], body: tarefasConcluidas.map((t) => [t]), styles: { fontSize: 9 } })
    // @ts-expect-error lastAutoTable é injetado pelo plugin
    y = doc.lastAutoTable.finalY + 10
  }

  // Horas agrupadas por tarefa
  const porTarefa = new Map<string, { horas: number; valor: number; descricoes: string[] }>()
  for (const h of horas) {
    const g = porTarefa.get(h.tarefa) ?? { horas: 0, valor: 0, descricoes: [] }
    g.horas += h.horas
    g.valor += h.horas * h.valor_venda_aplicado
    if (opcoes.mostrarDescricoes && h.descricao) g.descricoes.push(h.descricao)
    porTarefa.set(h.tarefa, g)
  }
  const totalHoras = [...porTarefa.values()].reduce((s, g) => s + g.valor, 0)
  doc.setFontSize(12)
  doc.text('Horas por tarefa', 14, y)
  const head = opcoes.mostrarDescricoes ? ['Tarefa', 'Descrição', 'Horas', 'Valor'] : ['Tarefa', 'Horas', 'Valor']
  const body = [...porTarefa.entries()].map(([t, g]) =>
    opcoes.mostrarDescricoes ? [t, g.descricoes.join('; '), fmtHoras(g.horas), brl(g.valor)] : [t, fmtHoras(g.horas), brl(g.valor)])
  autoTable(doc, { startY: y + 3, head: [head], body, styles: { fontSize: 9 } })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 10

  let totalCustos = 0
  if (opcoes.incluirCustos && custos.length) {
    totalCustos = custos.reduce((s, c) => s + c.valor, 0)
    doc.text('Custos repassados', 14, y)
    autoTable(doc, {
      startY: y + 3, head: [['Data', ...(opcoes.mostrarDescricoes ? ['Descrição'] : []), 'Valor']],
      body: custos.map((c) => [fmtData(c.data), ...(opcoes.mostrarDescricoes ? [c.descricao] : []), brl(c.valor)]), styles: { fontSize: 9 },
    })
    // @ts-expect-error lastAutoTable é injetado pelo plugin
    y = doc.lastAutoTable.finalY + 10
  }

  doc.setFontSize(13)
  doc.text(`Total a cobrar: ${brl(totalHoras + totalCustos)}`, 196, y, { align: 'right' })
  doc.save(`relatorio-${projeto.nome.replace(/\W+/g, '_')}-${de}_${ate}.pdf`)
  return totalHoras + totalCustos
}
