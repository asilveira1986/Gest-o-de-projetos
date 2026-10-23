import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type Linha = (string | number)[]

export interface Tabela {
  titulo: string
  colunas: string[]
  linhas: Linha[]
}

function baixar(blob: Blob, nome: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportarCSV(tabelas: Tabela[], nome: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const txt = tabelas
    .map((t) => [esc(t.titulo), t.colunas.map(esc).join(';'), ...t.linhas.map((l) => l.map(esc).join(';'))].join('\n'))
    .join('\n\n')
  baixar(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }), `${nome}.csv`)
}

export function exportarExcel(tabelas: Tabela[], nome: string) {
  const wb = XLSX.utils.book_new()
  tabelas.forEach((t, i) => {
    const ws = XLSX.utils.aoa_to_sheet([t.colunas, ...t.linhas])
    XLSX.utils.book_append_sheet(wb, ws, t.titulo.slice(0, 28) || `Aba ${i + 1}`)
  })
  XLSX.writeFile(wb, `${nome}.xlsx`)
}

export function exportarPDF(titulo: string, subtitulo: string, tabelas: Tabela[], nome: string) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(titulo, 14, 18)
  doc.setFontSize(10)
  doc.text(subtitulo, 14, 25)
  let y = 32
  for (const t of tabelas) {
    doc.setFontSize(12)
    doc.text(t.titulo, 14, y)
    autoTable(doc, { startY: y + 3, head: [t.colunas], body: t.linhas.map((l) => l.map(String)), styles: { fontSize: 9 } })
    // @ts-expect-error lastAutoTable é injetado pelo plugin
    y = doc.lastAutoTable.finalY + 12
  }
  doc.save(`${nome}.pdf`)
}
