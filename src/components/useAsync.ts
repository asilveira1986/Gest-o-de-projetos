import { useCallback, useEffect, useState } from 'react'

/** Carrega dados assíncronos com recarga manual. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(() => {
    setCarregando(true)
    return fn()
      .then((d) => {
        setDados(d)
        setErro(null)
      })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, deps)

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { dados, erro, carregando, recarregar }
}
