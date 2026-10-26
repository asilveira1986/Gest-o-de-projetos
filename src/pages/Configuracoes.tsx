import { useState } from 'react'
import { Campo, Carregando, Erro } from '../components/ui'
import { baixarExcel, baixarJson, baixarZip, coletarDados, registrarBackup, totalDeLinhas, ultimoBackup } from '../lib/backup'
import { fmtData, hoje } from '../lib/format'
import { diasEntre } from '../lib/calc'
import { useCarga } from '../components/useAsync'
import { useAuth } from '../lib/auth'
import { ok, supabase } from '../lib/supabase'
import type { Usuario } from '../lib/types'

function Backup() {
  const [ocupado, setOcupado] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState(ultimoBackup())
  const atrasado = !ultimo || diasEntre(ultimo, hoje()) > 30

  async function exportar(formato: 'json' | 'excel' | 'zip') {
    setOcupado(true); setErro(null); setStatus('Lendo dados…')
    try {
      const d = await coletarDados((t, i, n) => setStatus(`Lendo ${t} (${i + 1}/${n})…`))
      if (formato === 'json') baixarJson(d)
      else if (formato === 'excel') await baixarExcel(d)
      else {
        const r = await baixarZip(d, setStatus)
        if (r.falhas.length) setErro(`${r.falhas.length} arquivo(s) não puderam ser baixados (listados em arquivos/FALHAS.txt no ZIP).`)
      }
      registrarBackup(); setUltimo(hoje())
      setStatus(`Backup gerado: ${totalDeLinhas(d)} registros.`)
    } catch (e) { setErro((e as Error).message); setStatus(null) } finally { setOcupado(false) }
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-medium">Backup completo</h2>
      <p className="text-sm text-slate-600">Baixa todos os dados do sistema (projetos, tarefas, horas, custos, clientes, faturas, modelos e configurações).</p>
      <p className={`rounded-lg px-3 py-2 text-sm ${atrasado ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-800'}`}>
        {ultimo ? `Último backup feito neste navegador: ${fmtData(ultimo)}.` : 'Nenhum backup feito neste navegador ainda.'}{atrasado && ' Recomendado: fazer um backup agora.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={ocupado} onClick={() => exportar('zip')}>ZIP completo (dados + arquivos)</button>
        <button className="btn-secondary" disabled={ocupado} onClick={() => exportar('json')}>Só dados (JSON)</button>
        <button className="btn-secondary" disabled={ocupado} onClick={() => exportar('excel')}>Planilha (Excel)</button>
      </div>
      {status && <p className="text-sm text-slate-600">{status}</p>}
      <Erro msg={erro} />
      <p className="text-xs text-slate-500">O ZIP inclui comprovantes e anexos. JSON e Excel levam só os dados (o JSON guarda o caminho de cada arquivo). Este backup é seu, fora do Supabase; guarde-o em local seguro. A restauração automática ainda não existe.</p>
    </section>
  )
}

export function Configuracoes() {
  const { usuario } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [novaCat, setNovaCat] = useState('')
  const { dados, carregando, recarregar } = useCarga(async () => ({
    usuarios: ok(await supabase.from('usuarios').select('*').order('nome')) as Usuario[],
    categorias: ok(await supabase.from('categorias_custo').select('*').order('nome')) as { id: string; nome: string }[],
    config: ok(await supabase.from('configuracoes').select('*').eq('id', 1).single()) as { empresa_nome: string | null; logo_data: string | null; dados_pagamento: string | null },
  }), [])

  if (usuario?.perfil !== 'admin') return <Erro msg="Apenas administradores acessam as configurações." />
  if (carregando && !dados) return <Carregando />
  if (!dados) return null

  const tenta = async (fn: () => Promise<unknown>) => { try { await fn(); setErro(null); void recarregar() } catch (e) { setErro((e as Error).message) } }
  const salvarUsuario = (u: Usuario, patch: Partial<Usuario>) => tenta(async () => ok(await supabase.from('usuarios').update(patch).eq('id', u.id)))
  const logo = (f?: File) => {
    if (!f) return
    const rd = new FileReader()
    rd.onload = () => tenta(async () => ok(await supabase.from('configuracoes').update({ logo_data: rd.result as string }).eq('id', 1)))
    rd.readAsDataURL(f)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <Erro msg={erro} />
      <section className="card space-y-3">
        <h2 className="font-medium">Usuários e valor/hora (custo)</h2>
        {dados.usuarios.map((u) => (
          <div key={u.id} className="grid grid-cols-2 items-end gap-2 text-sm sm:grid-cols-5">
            <div className="col-span-2"><p className="font-medium">{u.nome}</p><p className="text-xs text-slate-500">{u.email}</p></div>
            <Campo rotulo="Valor/hora (R$)">
              <input className="input" inputMode="decimal" defaultValue={String(u.valor_hora).replace('.', ',')}
                onBlur={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v !== u.valor_hora && v >= 0) void salvarUsuario(u, { valor_hora: v }) }} />
            </Campo>
            <Campo rotulo="Perfil"><select className="input" value={u.perfil} onChange={(e) => salvarUsuario(u, { perfil: e.target.value as Usuario['perfil'] })}><option value="admin">Administrador</option><option value="colaborador">Colaborador</option></select></Campo>
            <label className="flex items-center gap-2"><input type="checkbox" checked={u.ativo} onChange={(e) => salvarUsuario(u, { ativo: e.target.checked })} /> Ativo</label>
          </div>
        ))}
        <p className="text-xs text-slate-500">Reajustes valem para novos lançamentos; os já feitos mantêm o valor/hora aplicado na época.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Categorias de custo</h2>
        <div className="flex flex-wrap gap-2">{dados.categorias.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm">{c.nome}
            <button className="text-slate-400 hover:text-red-600" onClick={() => tenta(async () => ok(await supabase.from('categorias_custo').delete().eq('id', c.id)))}>×</button></span>))}</div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (novaCat.trim()) void tenta(async () => { ok(await supabase.from('categorias_custo').insert({ nome: novaCat.trim() })); setNovaCat('') }) }}>
          <input className="input" placeholder="Nova categoria" value={novaCat} onChange={(e) => setNovaCat(e.target.value)} /><button className="btn-secondary">Adicionar</button></form>
      </section>

      <Backup />

      <section className="card space-y-3">
        <h2 className="font-medium">Relatório e fatura do cliente</h2>
        <Campo rotulo="Nome da empresa"><input className="input" defaultValue={dados.config.empresa_nome ?? ''}
          onBlur={(e) => tenta(async () => ok(await supabase.from('configuracoes').update({ empresa_nome: e.target.value || null }).eq('id', 1)))} /></Campo>
        <Campo rotulo="Dados para pagamento (aparecem na fatura)">
          <textarea className="input" rows={3} placeholder="Pix: ...&#10;Banco, agência e conta: ..." defaultValue={dados.config.dados_pagamento ?? ''}
            onBlur={(e) => tenta(async () => ok(await supabase.from('configuracoes').update({ dados_pagamento: e.target.value || null }).eq('id', 1)))} />
        </Campo>
        <Campo rotulo="Logo (PNG/JPG)"><input type="file" accept="image/png,image/jpeg" onChange={(e) => logo(e.target.files?.[0])} /></Campo>
        {dados.config.logo_data && <img src={dados.config.logo_data} alt="Logo" className="h-16" />}
      </section>
    </div>
  )
}
