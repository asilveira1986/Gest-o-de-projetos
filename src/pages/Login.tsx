import { useState } from 'react'
import { Erro, Campo } from '../components/ui'
import { configurado, supabase } from '../lib/supabase'

export function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'recuperar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setInfo(null)
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) setErro('E-mail ou senha inválidos.')
    } else if (modo === 'criar') {
      const { error, data } = await supabase.auth.signUp({ email, password: senha })
      if (error) setErro(error.message)
      else if (!data.session) setInfo('Conta criada. Confirme o e-mail e entre.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin })
      if (error) setErro(error.message)
      else setInfo('Enviamos um link de recuperação para o seu e-mail.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={enviar} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Controle de Projetos</h1>
        {!configurado && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).
          </p>
        )}
        <Campo rotulo="E-mail">
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Campo>
        {modo !== 'recuperar' && (
          <Campo rotulo="Senha">
            <input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          </Campo>
        )}
        <Erro msg={erro} />
        {info && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}
        <button className="btn-primary w-full">
          {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
        </button>
        <div className="flex justify-between text-xs text-blue-700">
          <button type="button" onClick={() => setModo(modo === 'criar' ? 'entrar' : 'criar')}>
            {modo === 'criar' ? 'Já tenho conta' : 'Criar conta'}
          </button>
          <button type="button" onClick={() => setModo(modo === 'recuperar' ? 'entrar' : 'recuperar')}>
            {modo === 'recuperar' ? 'Voltar' : 'Esqueci a senha'}
          </button>
        </div>
      </form>
    </div>
  )
}
