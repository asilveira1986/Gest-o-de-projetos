import { fmtHoras } from './format'
import type { Cliente, Fatura } from './types'

/** Portal do governo (Emissor Nacional da NFS-e). */
export const URL_PORTAL_NFSE = 'https://www.nfse.gov.br/EmissorNacional'

const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

function digitoVerificador(base: number[], pesos: number[]) {
  const soma = base.reduce((s, d, i) => s + d * pesos[i], 0)
  const r = soma % 11
  return r < 2 ? 0 : 11 - r
}

export function cpfValido(doc: string): boolean {
  const d = digitos(doc)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const n = d.split('').map(Number)
  const d1 = digitoVerificador(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digitoVerificador(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === n[9] && d2 === n[10]
}

export function cnpjValido(doc: string): boolean {
  const d = digitos(doc)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const n = d.split('').map(Number)
  const d1 = digitoVerificador(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digitoVerificador(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === n[12] && d2 === n[13]
}

export type TipoDoc = 'CPF' | 'CNPJ' | null
export const tipoDocumento = (doc: string | null | undefined): TipoDoc =>
  digitos(doc).length === 11 ? 'CPF' : digitos(doc).length === 14 ? 'CNPJ' : null

export const documentoValido = (doc: string | null | undefined) => {
  const t = tipoDocumento(doc)
  return t === 'CPF' ? cpfValido(doc!) : t === 'CNPJ' ? cnpjValido(doc!) : false
}

export interface ConfigNfse {
  nfse_codigo_servico: string | null
  nfse_descricao_padrao: string | null
  nfse_municipio: string | null
}

export interface DadosNota {
  tomador: { nome: string; documento: string; tipo: TipoDoc; email: string; telefone: string; endereco: string }
  servico: { codigo: string; descricao: string; municipio: string }
  valor: number
  competencia: string // mm/aaaa
}

const LIMITE_DESCRICAO = 2000

/** Texto do serviço: descrição padrão + fatura + resumo de horas por projeto (cabe no limite do portal). */
export function descricaoNota(
  padrao: string | null,
  fatura: Pick<Fatura, 'descricao' | 'emitida_em'>,
  itens: { projeto: string; horas: number }[],
): string {
  const [ano, mes] = fatura.emitida_em.split('-')
  const linhas: string[] = []
  if (padrao?.trim()) linhas.push(padrao.trim())
  if (fatura.descricao?.trim()) linhas.push(fatura.descricao.trim())
  linhas.push(`Competência: ${mes}/${ano}`)
  const porProjeto = new Map<string, number>()
  itens.forEach((i) => porProjeto.set(i.projeto, (porProjeto.get(i.projeto) ?? 0) + i.horas))
  porProjeto.forEach((h, p) => linhas.push(`- ${p}: ${fmtHoras(h)}`))
  const texto = linhas.join('\n')
  return texto.length > LIMITE_DESCRICAO ? texto.slice(0, LIMITE_DESCRICAO - 1) + '…' : texto
}

export function enderecoTexto(c: Pick<Cliente, 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf' | 'cep'>): string {
  const rua = [c.logradouro, c.numero].filter(Boolean).join(', ')
  const cidadeUf = [c.cidade, c.uf].filter(Boolean).join('/')
  return [rua, c.complemento, c.bairro, cidadeUf, c.cep ? `CEP ${c.cep}` : ''].filter(Boolean).join(' - ')
}

export function montarDadosNota(
  fatura: Fatura,
  cliente: Cliente,
  config: ConfigNfse,
  itens: { projeto: string; horas: number }[],
): DadosNota {
  const [ano, mes] = fatura.emitida_em.split('-')
  return {
    tomador: {
      nome: cliente.nome, documento: cliente.documento ?? '', tipo: tipoDocumento(cliente.documento),
      email: cliente.email ?? '', telefone: cliente.telefone ?? '', endereco: enderecoTexto(cliente),
    },
    servico: {
      codigo: config.nfse_codigo_servico ?? '', municipio: config.nfse_municipio ?? '',
      descricao: descricaoNota(config.nfse_descricao_padrao, fatura, itens),
    },
    valor: fatura.valor,
    competencia: `${mes}/${ano}`,
  }
}

/** Pendências que o usuário deve resolver (ou conferir) antes de emitir no portal. */
export function pendenciasNota(d: DadosNota): { texto: string; bloqueia: boolean }[] {
  const p: { texto: string; bloqueia: boolean }[] = []
  if (!d.tomador.documento) p.push({ texto: 'O cliente não tem CPF/CNPJ cadastrado.', bloqueia: true })
  else if (!documentoValido(d.tomador.documento)) p.push({ texto: 'O CPF/CNPJ do cliente parece inválido (dígito verificador).', bloqueia: true })
  if (!(d.valor > 0)) p.push({ texto: 'Fatura sem valor.', bloqueia: true })
  if (!d.servico.codigo) p.push({ texto: 'Defina o código do serviço em Configurações → NFS-e.', bloqueia: false })
  if (!d.tomador.endereco) p.push({ texto: 'O cliente não tem endereço cadastrado; o portal pode exigi-lo.', bloqueia: false })
  return p
}

// ───────── leitura do XML baixado do portal ─────────

export interface DadosXml {
  numero: string | null
  chave: string | null
  emitidaEm: string | null // yyyy-mm-dd
  valor: number | null
  documentoTomador: string | null
}

const tag = (xml: string, nome: string) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${nome}>`))
  return m ? m[1].trim() : null
}

/**
 * Extrai número, chave de acesso, data, valor e documento do tomador de um XML de NFS-e Nacional.
 * É uma leitura tolerante (por nome de tag): se o layout mudar, os campos vêm nulos
 * e o usuário preenche à mão. O resultado deve sempre ser conferido antes de salvar.
 */
export function lerXmlNfse(xml: string): DadosXml {
  const id = xml.match(/<(?:\w+:)?infNFSe[^>]*\sId="([^"]+)"/)?.[1] ?? null
  const chave = id ? id.replace(/^NFS/, '') : null
  const data = tag(xml, 'dhEmi') ?? tag(xml, 'dhProc') ?? tag(xml, 'dCompet')
  const valorTxt = tag(xml, 'vServ') ?? tag(xml, 'vLiq')
  const toma = xml.match(/<(?:\w+:)?toma>([\s\S]*?)<\/(?:\w+:)?toma>/)?.[1]
  return {
    numero: tag(xml, 'nNFSe'),
    chave: chave && /^\d{50}$/.test(chave) ? chave : null,
    emitidaEm: data && /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : null,
    valor: valorTxt && !Number.isNaN(Number(valorTxt)) ? Number(valorTxt) : null,
    documentoTomador: toma ? tag(toma, 'CNPJ') ?? tag(toma, 'CPF') : null,
  }
}

/** Confere a nota registrada com a fatura; devolve avisos (vazio = tudo certo). */
export function conferirNota(
  fatura: Pick<Fatura, 'valor'>,
  cliente: Pick<Cliente, 'documento'>,
  nota: Partial<DadosXml>,
): string[] {
  const avisos: string[] = []
  if (nota.valor != null && Math.abs(nota.valor - fatura.valor) > 0.009) {
    avisos.push(`O valor da nota (${nota.valor.toFixed(2)}) é diferente do valor da fatura (${fatura.valor.toFixed(2)}).`)
  }
  if (nota.documentoTomador && cliente.documento && digitos(nota.documentoTomador) !== digitos(cliente.documento)) {
    avisos.push('O CPF/CNPJ do tomador na nota é diferente do cadastrado no cliente.')
  }
  if (nota.chave && !/^\d{50}$/.test(nota.chave)) avisos.push('A chave de acesso deve ter 50 dígitos.')
  return avisos
}

export const STATUS_NFSE = { pendente: 'NFS-e pendente', emitida: 'NFS-e emitida', dispensada: 'Sem NFS-e' } as const
