import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Item {
  id: string
  rotulo: string
  detalhe?: string
  grupo: 'Ações' | 'Páginas' | 'Projetos' | 'Tarefas'
  acao: () => void
}

/** Normaliza para busca sem acento/caixa ("Relatórios" casa com "relatorios"). */
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Paleta de comandos (Ctrl/⌘+K): páginas, ações, projetos e tarefas. */
export function Busca({ aberta, onFechar, onLancar }: { aberta: boolean; onFechar: () => void; onLancar: (t: 'hora' | 'custo') => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [remotos, setRemotos] = useState<Item[]>([])
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const ir = (to: string) => () => { nav(to); onFechar() }
  const fixos = useMemo<Item[]>(() => [
    { id: 'a1', rotulo: 'Lançar horas', grupo: 'Ações', acao: () => { onFechar(); onLancar('hora') } },
    { id: 'a2', rotulo: 'Lançar custo', grupo: 'Ações', acao: () => { onFechar(); onLancar('custo') } },
    { id: 'p00', rotulo: 'Hoje', grupo: 'Páginas', acao: ir('/') },
    { id: 'p0', rotulo: 'Painel', grupo: 'Páginas', acao: ir('/painel') },
    { id: 'p1', rotulo: 'Projetos', grupo: 'Páginas', acao: ir('/projetos') },
    { id: 'p2', rotulo: 'Clientes', grupo: 'Páginas', acao: ir('/clientes') },
    { id: 'p3', rotulo: 'Faturamento', grupo: 'Páginas', acao: ir('/faturamento') },
    { id: 'p4', rotulo: 'Relatórios', grupo: 'Páginas', acao: ir('/relatorios') },
    { id: 'p5', rotulo: 'Configurações', grupo: 'Páginas', acao: ir('/configuracoes') },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  useEffect(() => {
    if (aberta) { setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 0) }
  }, [aberta])

  // projetos e tarefas: consulta no banco com debounce
  useEffect(() => {
    const termo = q.trim()
    if (!aberta || termo.length < 2) { setRemotos([]); return }
    let cancelado = false
    const t = setTimeout(async () => {
      const like = `%${termo.replace(/[%,]/g, ' ')}%`
      const [p, ta] = await Promise.all([
        supabase.from('projetos').select('id,nome,clientes(nome)').ilike('nome', like).limit(6),
        supabase.from('tarefas').select('id,titulo,projetos(nome)').ilike('titulo', like).limit(8),
      ])
      if (cancelado) return
      const projs = ((p.data ?? []) as unknown as { id: string; nome: string; clientes: { nome: string } | null }[]).map<Item>((x) => ({
        id: `pr${x.id}`, rotulo: x.nome, detalhe: x.clientes?.nome, grupo: 'Projetos', acao: ir(`/projetos/${x.id}`),
      }))
      const tars = ((ta.data ?? []) as unknown as { id: string; titulo: string; projetos: { nome: string } | null }[]).map<Item>((x) => ({
        id: `ta${x.id}`, rotulo: x.titulo, detalhe: x.projetos?.nome, grupo: 'Tarefas', acao: ir(`/tarefas/${x.id}`),
      }))
      setRemotos([...projs, ...tars]); setSel(0)
    }, 200)
    return () => { cancelado = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, aberta])

  const itens = useMemo(() => {
    const n = norm(q.trim())
    const locais = n ? fixos.filter((i) => norm(i.rotulo).includes(n)) : fixos
    return [...locais, ...remotos]
  }, [q, fixos, remotos])

  if (!aberta) return null

  function tecla(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, itens.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); itens[sel]?.acao() }
    else if (e.key === 'Escape') onFechar()
  }

  let grupoAnterior = ''
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink-950/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} onKeyDown={tecla}
          placeholder="Buscar projeto, tarefa, página ou ação…" className="w-full border-b border-slate-200 px-5 py-4 text-base focus:outline-none" />
        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {!itens.length && <li className="px-5 py-6 text-center text-sm text-slate-500">Nada encontrado.</li>}
          {itens.map((it, i) => {
            const cab = it.grupo !== grupoAnterior ? it.grupo : null
            grupoAnterior = it.grupo
            return (
              <li key={it.id}>
                {cab && <p className="px-5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{cab}</p>}
                <button onMouseEnter={() => setSel(i)} onClick={it.acao}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-2 text-left text-sm ${i === sel ? 'bg-brand-50 text-brand-800' : ''}`}>
                  <span className="truncate font-medium">{it.rotulo}</span>
                  {it.detalhe && <span className="truncate text-xs text-slate-500">{it.detalhe}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="border-t border-slate-100 bg-ink-50 px-5 py-2 text-xs text-slate-500">↑↓ navegar · Enter abrir · Esc fechar</p>
      </div>
    </div>
  )
}
