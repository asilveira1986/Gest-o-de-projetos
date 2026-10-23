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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-700/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
          </span>
          <span className="font-bold">Controle de Projetos</span>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight !text-white">Horas, custos e orçamento<br /><span className="text-brand-300">em um só lugar.</span></h2>
          <ul className="space-y-3 text-slate-300">
            {['Cronômetro por tarefa que não para ao fechar o navegador', 'Orçamento consumido em tempo real, com alertas', 'Relatório em PDF pronto para enviar ao cliente'].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/20 text-xs text-brand-300">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Lançar uma hora ou um custo leva menos de 30 segundos.</p>
      </div>
      <div className="flex items-center justify-center bg-ink-50 p-6">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-5">
          <div>
            <h1>{modo === 'entrar' ? 'Bem-vindo de volta' : modo === 'criar' ? 'Criar sua conta' : 'Recuperar senha'}</h1>
            <p className="mt-1 text-sm text-slate-500">{modo === 'criar' ? 'O primeiro usuário vira administrador.' : 'Acesse seus projetos, horas e custos.'}</p>
          </div>
          {!configurado && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).</p>}
          <Campo rotulo="E-mail"><input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Campo>
          {modo !== 'recuperar' && <Campo rotulo="Senha"><input type="password" className="input" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} /></Campo>}
          <Erro msg={erro} />
          {info && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{info}</p>}
          <button className="btn-primary w-full !py-2.5">{modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}</button>
          <div className="flex justify-between text-xs font-medium text-brand-700">
            <button type="button" onClick={() => setModo(modo === 'criar' ? 'entrar' : 'criar')}>{modo === 'criar' ? 'Já tenho conta' : 'Criar conta'}</button>
            <button type="button" onClick={() => setModo(modo === 'recuperar' ? 'entrar' : 'recuperar')}>{modo === 'recuperar' ? 'Voltar' : 'Esqueci a senha'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
