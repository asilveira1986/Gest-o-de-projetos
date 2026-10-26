import { hoje } from './format'
import { supabase } from './supabase'

/** Tabelas do sistema, na ordem em que fazem sentido para restaurar. */
export const TABELAS = [
  'usuarios', 'clientes', 'projetos', 'projeto_membros', 'tarefas', 'subtarefas', 'lancamentos_horas',
  'intervalos_tempo', 'categorias_custo', 'custos_recorrentes', 'custos', 'faturas', 'comentarios', 'anexos',
  'modelos_projeto', 'configuracoes',
] as const

export type Tabela = (typeof TABELAS)[number]
export type Dump = Record<Tabela, Record<string, unknown>[]>

const PAGINA = 1000 // limite padrão de linhas por consulta do Supabase

/** Lê a tabela inteira, paginando. */
async function lerTudo(tabela: Tabela): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from(tabela).select('*').range(de, de + PAGINA - 1)
    if (error) throw new Error(`${tabela}: ${error.message}`)
    linhas.push(...(data as Record<string, unknown>[]))
    if (!data || data.length < PAGINA) return linhas
  }
}

export async function coletarDados(progresso?: (tabela: string, i: number, total: number) => void): Promise<Dump> {
  const dump = {} as Dump
  for (const [i, t] of TABELAS.entries()) {
    progresso?.(t, i, TABELAS.length)
    dump[t] = await lerTudo(t)
  }
  return dump
}

/** Excel limita a célula a 32.767 caracteres (logo em base64 passa disso) e não aceita objetos. */
export const LIMITE_CELULA = 32000
export function linhaParaExcel(linha: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const saida: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(linha)) {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') saida[k] = v as number | boolean | null
    else {
      const txt = typeof v === 'string' ? v : JSON.stringify(v)
      saida[k] = txt.length > LIMITE_CELULA ? `[${txt.length} caracteres — veja o backup JSON]` : txt
    }
  }
  return saida
}

export const totalDeLinhas = (d: Dump) => TABELAS.reduce((s, t) => s + d[t].length, 0)

const nomeBase = () => `backup-controle-projetos-${hoje()}`

function baixar(blob: Blob, nome: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

const envelope = (d: Dump) => ({ sistema: 'controle-de-projetos', versao: 1, exportado_em: new Date().toISOString(), tabelas: d })

export function baixarJson(d: Dump) {
  baixar(new Blob([JSON.stringify(envelope(d), null, 2)], { type: 'application/json' }), `${nomeBase()}.json`)
}

export async function baixarExcel(d: Dump) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const t of TABELAS) {
    const ws = XLSX.utils.json_to_sheet(d[t].map(linhaParaExcel))
    XLSX.utils.book_append_sheet(wb, ws, t.slice(0, 31))
  }
  XLSX.writeFile(wb, `${nomeBase()}.xlsx`)
}

/** ZIP com o JSON e todos os arquivos dos buckets (comprovantes e anexos). */
export async function baixarZip(d: Dump, progresso?: (txt: string) => void): Promise<{ arquivos: number; falhas: string[] }> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  zip.file('dados.json', JSON.stringify(envelope(d), null, 2))
  const caminhos: [string, string][] = [
    ...d.custos.filter((c) => c.comprovante_url).map((c) => ['comprovantes', String(c.comprovante_url)] as [string, string]),
    ...d.faturas.flatMap((f) => [f.nfse_pdf, f.nfse_xml]).filter(Boolean).map((c) => ['anexos', String(c)] as [string, string]),
    ...d.anexos.filter((a) => a.caminho).map((a) => ['anexos', String(a.caminho)] as [string, string]),
  ]
  const falhas: string[] = []
  let ok = 0
  for (const [i, [bucket, caminho]] of caminhos.entries()) {
    progresso?.(`Arquivo ${i + 1} de ${caminhos.length}`)
    const { data, error } = await supabase.storage.from(bucket).download(caminho)
    if (error || !data) { falhas.push(`${bucket}/${caminho}`); continue }
    zip.file(`arquivos/${bucket}/${caminho}`, data)
    ok++
  }
  if (falhas.length) zip.file('arquivos/FALHAS.txt', falhas.join('\n'))
  baixar(await zip.generateAsync({ type: 'blob' }), `${nomeBase()}.zip`)
  return { arquivos: ok, falhas }
}

const CHAVE = 'ultimo-backup'
export function registrarBackup() { try { localStorage.setItem(CHAVE, hoje()) } catch { /* sem storage */ } }
export function ultimoBackup(): string | null { try { return localStorage.getItem(CHAVE) } catch { return null } }
