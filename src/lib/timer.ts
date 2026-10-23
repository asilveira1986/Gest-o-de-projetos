import { horasDosIntervalos, pausaExpirada, round2, valorVendaEfetivo } from './calc'
import { hoje } from './format'
import { ok, supabase } from './supabase'
import type { Cliente, Intervalo, LancamentoHoras, Projeto, Tarefa, Usuario } from './types'

/**
 * Cronômetro baseado em horários gravados no banco: o tempo continua
 * contando mesmo com o navegador fechado (a tela só recalcula a partir dos
 * intervalos). Cada Iniciar/Retomar abre um intervalo; Pausar/Parar o fecham.
 */

const SEL = '*, intervalos_tempo(*), tarefas(id,titulo,projeto_id)'

export interface Ativo extends LancamentoHoras {
  intervalos_tempo: Intervalo[]
}

/** Lançamentos em andamento (rodando ou pausados) do usuário. */
export async function listarAtivos(usuarioId: string): Promise<Ativo[]> {
  const r = await supabase
    .from('lancamentos_horas')
    .select(SEL)
    .eq('usuario_id', usuarioId)
    .in('estado', ['rodando', 'pausado'])
    .order('inicio', { ascending: false })
  return ok(r) as Ativo[]
}

/** Segundos já contados de um lançamento ativo (intervalo aberto conta até agora). */
export const segundos = (a: Ativo, agora = new Date()) =>
  Math.round(horasDosIntervalos(a.intervalos_tempo ?? [], agora) * 3600)

async function fecharIntervaloAberto(lancamentoId: string, fim: Date) {
  ok(
    await supabase
      .from('intervalos_tempo')
      .update({ fim: fim.toISOString() })
      .eq('lancamento_id', lancamentoId)
      .is('fim', null),
  )
}

async function somaHoras(lancamentoId: string) {
  const r = await supabase.from('intervalos_tempo').select('*').eq('lancamento_id', lancamentoId)
  return round2(horasDosIntervalos(ok(r) as Intervalo[]))
}

export async function pausar(lancamentoId: string) {
  const agora = new Date()
  await fecharIntervaloAberto(lancamentoId, agora)
  const horas = await somaHoras(lancamentoId)
  ok(await supabase.from('lancamentos_horas').update({ estado: 'pausado', horas }).eq('id', lancamentoId))
}

export async function retomar(lancamentoId: string, usuarioId: string) {
  await pausarRodando(usuarioId)
  ok(await supabase.from('intervalos_tempo').insert({ lancamento_id: lancamentoId, inicio: new Date().toISOString() }))
  ok(await supabase.from('lancamentos_horas').update({ estado: 'rodando' }).eq('id', lancamentoId))
}

export async function parar(lancamentoId: string, descricao: string | null) {
  const agora = new Date()
  await fecharIntervaloAberto(lancamentoId, agora)
  const horas = await somaHoras(lancamentoId)
  ok(
    await supabase
      .from('lancamentos_horas')
      .update({ estado: 'finalizado', fim: agora.toISOString(), horas, descricao })
      .eq('id', lancamentoId),
  )
}

/** Um único cronômetro ativo por vez: pausa o que estiver rodando. */
export async function pausarRodando(usuarioId: string) {
  const r = await supabase
    .from('lancamentos_horas')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'rodando')
  for (const l of ok(r) as { id: string }[]) await pausar(l.id)
}

/**
 * Iniciar: retoma a sessão pausada da tarefa, se houver; senão cria uma nova.
 * Move a tarefa para "Em andamento" se estiver em "A fazer".
 */
export async function iniciar(tarefa: Tarefa, usuario: Usuario, projeto: Projeto & { clientes?: Cliente | null }) {
  if (['concluido', 'cancelado'].includes(projeto.status) && usuario.perfil !== 'admin') {
    throw new Error('Projeto concluído/cancelado: novos lançamentos bloqueados.')
  }
  const ativos = await listarAtivos(usuario.id)
  const pausada = ativos.find((a) => a.tarefa_id === tarefa.id && a.estado === 'pausado')
  if (pausada) {
    await retomar(pausada.id, usuario.id)
  } else {
    await pausarRodando(usuario.id)
    const agora = new Date().toISOString()
    const novo = ok(
      await supabase
        .from('lancamentos_horas')
        .insert({
          tarefa_id: tarefa.id,
          usuario_id: usuario.id,
          data: hoje(),
          inicio: agora,
          horas: 0,
          valor_hora_aplicado: usuario.valor_hora,
          valor_venda_aplicado: valorVendaEfetivo(projeto, projeto.clientes),
          faturavel: true,
          origem: 'cronometro',
          estado: 'rodando',
        })
        .select('id')
        .single(),
    ) as { id: string }
    ok(await supabase.from('intervalos_tempo').insert({ lancamento_id: novo.id, inicio: agora }))
  }
  if (tarefa.status === 'a_fazer') {
    ok(await supabase.from('tarefas').update({ status: 'em_andamento' }).eq('id', tarefa.id))
  }
}

/** Finaliza no último horário ativo os cronômetros pausados há mais de 8 h. */
export async function finalizarPausasExpiradas(usuarioId: string) {
  for (const a of await listarAtivos(usuarioId)) {
    if (a.estado !== 'pausado') continue
    const fins = a.intervalos_tempo.map((i) => i.fim).filter((f): f is string => !!f).sort()
    const ultimo = fins[fins.length - 1]
    if (ultimo && pausaExpirada(ultimo)) {
      const horas = await somaHoras(a.id)
      ok(await supabase.from('lancamentos_horas').update({ estado: 'finalizado', fim: ultimo, horas }).eq('id', a.id))
    }
  }
}

/** Horas já lançadas pelo usuário num dia (para a confirmação de >12 h/dia). */
export async function horasNoDia(usuarioId: string, data: string, ignorarId?: string) {
  const r = await supabase
    .from('lancamentos_horas')
    .select('id,horas')
    .eq('usuario_id', usuarioId)
    .eq('data', data)
  return (ok(r) as { id: string; horas: number }[])
    .filter((x) => x.id !== ignorarId)
    .reduce((s, x) => s + Number(x.horas), 0)
}
