import { useState } from 'react'
import { Campo, Carregando, Erro, Indicador } from '../components/ui'
import { useCarga } from '../components/useAsync'
import { custoMaoDeObra, custosRealizados, receita } from '../lib/calc'
import type { LancComTarefa } from '../lib/dados'
import { exportarCSV, exportarExcel, exportarPDF, type Tabela } from '../lib/export'
import { brl, fmtData, fmtHoras, hoje } from '../lib/format'
import { gerarRelatorioCliente } from '../lib/relatorioCliente'
import { ok, supabase } from '../lib/supabase'
import type { Cliente, Custo, Projeto, Tarefa } from '../lib/types'

type ProjetoCli = Projeto & { clientes: Cliente | null }

export function Relatorios() {
  const [projetoId, setProjetoId] = useState('')
  const hoje_ = hoje()
  const [de, setDe] = useState(hoje_.slice(0, 8) + '01')
  const [ate, setAte] = useState(hoje_)
  const [incluirCustos, setIncluirCustos] = useState(true)
  const [mostrarDescricoes, setMostrarDescricoes] = useState(false)
  const [incluirFaturados, setIncluirFaturados] = useState(false)
  const [marcar, setMarcar] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  const { dados: projetos } = useCarga(async () => ok(await supabase.from('projetos').select('*, clientes(*)').order('nome')) as ProjetoCli[], [])
  const { dados, erro, carregando, recarregar } = useCarga(async () => {
    if (!projetoId) return null
    const [h, c, t] = await Promise.all([
      supabase.from('lancamentos_horas').select('*, tarefas!inner(id,titulo,projeto_id), usuarios(id,nome)').eq('tarefas.projeto_id', projetoId).eq('estado', 'finalizado').gte('data', de).lte('data', ate),
      supabase.from('custos').select('*').eq('projeto_id', projetoId).gte('data', de).lte('data', ate),
      supabase.from('tarefas').select('*').eq('projeto_id', projetoId).eq('status', 'concluida'),
    ])
    return { horas: ok(h) as unknown as LancComTarefa[], custos: ok(c) as Custo[], concluidas: ok(t) as Tarefa[] }
  }, [projetoId, de, ate])

  const projeto = projetos?.find((p) => p.id === projetoId)

  function tabelas(): Tabela[] {
    if (!dados) return []
    const porPessoa = new Map<string, number>()
    dados.horas.forEach((h) => porPessoa.set(h.usuarios?.nome ?? '—', (porPessoa.get(h.usuarios?.nome ?? '—') ?? 0) + h.horas))
    const porCat = new Map<string, number>()
    dados.custos.filter((c) => c.situacao === 'realizado').forEach((c) => porCat.set(c.categoria, (porCat.get(c.categoria) ?? 0) + c.valor))
    return [
      { titulo: 'Horas por pessoa', colunas: ['Pessoa', 'Horas'], linhas: [...porPessoa.entries()].map(([n, v]) => [n, Number(v.toFixed(2))]) },
      { titulo: 'Custos por categoria', colunas: ['Categoria', 'Valor (R$)'], linhas: [...porCat.entries()].map(([n, v]) => [n, Number(v.toFixed(2))]) },
      { titulo: 'Lançamentos de horas', colunas: ['Data', 'Pessoa', 'Tarefa', 'Horas', 'Custo (R$)', 'Descrição'],
        linhas: dados.horas.map((h) => [fmtData(h.data), h.usuarios?.nome ?? '', h.tarefas.titulo, Number(h.horas), Number((h.horas * h.valor_hora_aplicado).toFixed(2)), h.descricao ?? '']) },
      { titulo: 'Custos diretos', colunas: ['Data', 'Descrição', 'Categoria', 'Situação', 'Valor (R$)'],
        linhas: dados.custos.map((c) => [fmtData(c.data), c.descricao, c.categoria, c.situacao, c.valor]) },
    ]
  }
  const nome = `relatorio-${projeto?.nome.replace(/\W+/g, '_') ?? 'projeto'}-${de}_${ate}`

  async function relatorioCliente() {
    if (!dados || !projeto) return
    setErroAcao(null)
    try {
      const cfg = ok(await supabase.from('configuracoes').select('*').eq('id', 1).single()) as { empresa_nome: string | null; logo_data: string | null }
      const linhas = dados.horas.filter((h) => h.faturavel && (incluirFaturados || !h.faturado_em))
      if (!linhas.length && !confirm('Não há horas faturáveis pendentes no período. Gerar mesmo assim?')) return
      gerarRelatorioCliente({
        projeto, cliente: projeto.clientes, empresa: { nome: cfg.empresa_nome, logo: cfg.logo_data }, de, ate,
        horas: linhas.map((h) => ({ tarefa: h.tarefas.titulo, data: h.data, horas: h.horas, valor_venda_aplicado: h.valor_venda_aplicado, descricao: h.descricao })),
        custos: dados.custos.filter((c) => c.repassar_cliente && c.situacao === 'realizado'),
        tarefasConcluidas: dados.concluidas.map((t) => t.titulo),
        opcoes: { incluirCustos, mostrarDescricoes },
      })
      const pendentes = linhas.filter((h) => !h.faturado_em)
      if (marcar && pendentes.length && confirm(`Marcar ${pendentes.length} lançamento(s) como faturados?`)) {
        ok(await supabase.from('lancamentos_horas').update({ faturado_em: hoje() }).in('id', pendentes.map((h) => h.id)))
        void recarregar()
      }
    } catch (e) { setErroAcao((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Relatórios</h1>
      <div className="card grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Projeto"><select className="input" value={projetoId} onChange={(e) => setProjetoId(e.target.value)}><option value="">Selecione…</option>{projetos?.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        <Campo rotulo="De"><input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} /></Campo>
        <Campo rotulo="Até"><input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>
      </div>
      <Erro msg={erro ?? erroAcao} />
      {carregando && projetoId && <Carregando />}
      {dados && projeto && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Horas" valor={fmtHoras(dados.horas.reduce((s, h) => s + h.horas, 0))} />
            <Indicador rotulo="Mão de obra" valor={brl(custoMaoDeObra(dados.horas))} />
            <Indicador rotulo="Custos diretos" valor={brl(custosRealizados(dados.custos))} />
            <Indicador rotulo="Receita" valor={brl(receita(dados.horas, dados.custos))} />
          </div>
          <div className="card space-y-2">
            <h2 className="font-medium">Relatório interno</h2>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => exportarExcel(tabelas(), nome)}>Excel</button>
              <button className="btn-secondary" onClick={() => exportarCSV(tabelas(), nome)}>CSV</button>
              <button className="btn-secondary" onClick={() => exportarPDF(`Relatório — ${projeto.nome}`, `Período ${fmtData(de)} a ${fmtData(ate)}`, tabelas(), nome)}>PDF</button>
            </div>
          </div>
          <div className="card space-y-2">
            <h2 className="font-medium">Relatório para o cliente (PDF)</h2>
            <p className="text-xs text-slate-500">Mostra apenas valores de venda. Custo interno e margem nunca aparecem.</p>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incluirCustos} onChange={(e) => setIncluirCustos(e.target.checked)} /> Incluir custos diretos repassados</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mostrarDescricoes} onChange={(e) => setMostrarDescricoes(e.target.checked)} /> Mostrar descrições internas</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={incluirFaturados} onChange={(e) => setIncluirFaturados(e.target.checked)} /> Incluir horas já faturadas</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={marcar} onChange={(e) => setMarcar(e.target.checked)} /> Marcar como faturadas ao gerar</label>
            <button className="btn-primary" onClick={relatorioCliente}>Gerar PDF do cliente</button>
          </div>
        </>
      )}
    </div>
  )
}
