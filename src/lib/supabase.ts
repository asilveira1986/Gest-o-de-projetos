import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = !!url && !!key

export const supabase = createClient(url ?? 'http://localhost', key ?? 'sem-chave')

/** Lança erro legível se a resposta do Supabase falhou. */
export function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

/** URL assinada (1 h) para arquivo em bucket privado. */
export async function urlAssinada(bucket: 'comprovantes' | 'anexos', caminho: string) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(caminho, 3600)
  return data?.signedUrl ?? null
}

export async function enviarArquivo(bucket: 'comprovantes' | 'anexos', arquivo: File, pasta: string) {
  const limpo = arquivo.name.replace(/[^\w.\-]+/g, '_')
  const caminho = `${pasta}/${Date.now()}_${limpo}`
  const { error } = await supabase.storage.from(bucket).upload(caminho, arquivo)
  if (error) throw new Error(error.message)
  return caminho
}
