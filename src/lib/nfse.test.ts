import { describe, expect, it } from 'vitest'
import {
  cnpjValido, conferirNota, cpfValido, descricaoNota, documentoValido, enderecoTexto, lerXmlNfse, montarDadosNota, pendenciasNota, tipoDocumento,
} from './nfse'

describe('CPF e CNPJ', () => {
  it('valida dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11.222.333/0001-80')).toBe(false)
    expect(cnpjValido('00000000000000')).toBe(false)
  })
  it('detecta o tipo pelo tamanho', () => {
    expect(tipoDocumento('529.982.247-25')).toBe('CPF')
    expect(tipoDocumento('11222333000181')).toBe('CNPJ')
    expect(tipoDocumento('123')).toBeNull()
    expect(documentoValido('')).toBe(false)
  })
})

const fatura = { id: 'x', cliente_id: 'c', projeto_id: null, descricao: 'Serviços de outubro', emitida_em: '2026-10-26', vencimento: '2026-11-10', valor: 1500, pago_em: null, valor_pago: null } as never
const clienteBase = { nome: 'Acme Ltda', documento: '11.222.333/0001-81', email: 'a@acme.com', telefone: '1199999', logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Campinas', uf: 'SP', cep: '13000-000' }
const cliente = clienteBase as never
const config = { nfse_codigo_servico: '01.07.01', nfse_descricao_padrao: 'Desenvolvimento de software', nfse_municipio: 'Campinas/SP' }

describe('dados da nota', () => {
  it('monta descrição com padrão, fatura, competência e horas por projeto', () => {
    const t = descricaoNota('Desenvolvimento de software', fatura, [{ projeto: 'Site', horas: 5 }, { projeto: 'Site', horas: 2.5 }, { projeto: 'App', horas: 1 }])
    expect(t).toBe('Desenvolvimento de software\nServiços de outubro\nCompetência: 10/2026\n- Site: 7h 30min\n- App: 1h 00min')
  })
  it('respeita o limite de 2000 caracteres', () => {
    const itens = Array.from({ length: 400 }, (_, i) => ({ projeto: `Projeto número ${i}`, horas: 1 }))
    expect(descricaoNota(null, fatura, itens).length).toBeLessThanOrEqual(2000)
  })
  it('monta endereço legível', () => {
    expect(enderecoTexto(cliente)).toBe('Rua A, 10 - Centro - Campinas/SP - CEP 13000-000')
  })
  it('lista pendências', () => {
    const ok = montarDadosNota(fatura, cliente, config, [])
    expect(pendenciasNota(ok)).toEqual([])
    const ruim = montarDadosNota(fatura, { ...clienteBase, documento: '123', logradouro: null, cidade: null, cep: null, bairro: null, numero: null, uf: null } as never, { ...config, nfse_codigo_servico: null }, [])
    const p = pendenciasNota(ruim)
    expect(p.filter((x) => x.bloqueia)).toHaveLength(1)
    expect(p.map((x) => x.texto).join(' ')).toMatch(/inválido/)
    expect(p.map((x) => x.texto).join(' ')).toMatch(/código do serviço/)
    expect(p.map((x) => x.texto).join(' ')).toMatch(/endereço/)
  })
})

const CHAVE = '35503082' + '1'.repeat(42)
const XML = `<?xml version="1.0"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${CHAVE}"><nNFSe>1234</nNFSe><dhProc>2026-10-26T10:15:00-03:00</dhProc>
<DPS><infDPS><dhEmi>2026-10-26T10:10:00-03:00</dhEmi><toma><CNPJ>11222333000181</CNPJ><xNome>Acme</xNome></toma><valores><vServPrest><vServ>1500.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`

describe('leitura do XML', () => {
  it('extrai número, chave, data, valor e tomador', () => {
    expect(lerXmlNfse(XML)).toEqual({ numero: '1234', chave: CHAVE, emitidaEm: '2026-10-26', valor: 1500, documentoTomador: '11222333000181' })
  })
  it('layout desconhecido devolve campos nulos sem quebrar', () => {
    expect(lerXmlNfse('<x>nada</x>')).toEqual({ numero: null, chave: null, emitidaEm: null, valor: null, documentoTomador: null })
  })
  it('confere valor e documento com a fatura', () => {
    expect(conferirNota(fatura, cliente, lerXmlNfse(XML))).toEqual([])
    const avisos = conferirNota(fatura, cliente, { valor: 1400, documentoTomador: '529.982.247-25', chave: '123' })
    expect(avisos).toHaveLength(3)
  })
})
