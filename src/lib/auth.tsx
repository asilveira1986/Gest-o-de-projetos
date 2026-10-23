import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Usuario } from './types'

interface Ctx {
  session: Session | null
  usuario: Usuario | null
  carregando: boolean
  sair: () => Promise<void>
}

const AuthCtx = createContext<Ctx>({ session: null, usuario: null, carregando: true, sair: async () => {} })
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        setUsuario(null)
        setCarregando(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setUsuario(data as Usuario | null)
        setCarregando(false)
      })
  }, [session])

  return (
    <AuthCtx.Provider value={{ session, usuario, carregando, sair: async () => void (await supabase.auth.signOut()) }}>
      {children}
    </AuthCtx.Provider>
  )
}
