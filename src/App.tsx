import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Carregando } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { finalizarPausasExpiradas } from './lib/timer'
import { Clientes } from './pages/Clientes'
import { Configuracoes } from './pages/Configuracoes'
import { Dashboard } from './pages/Dashboard'
import { Hoje } from './pages/Hoje'
import { Login } from './pages/Login'
import { Projetos } from './pages/Projetos'

const ProjetoPage = lazy(() => import('./pages/Projeto').then((m) => ({ default: m.ProjetoPage })))
const TarefaPage = lazy(() => import('./pages/Tarefa').then((m) => ({ default: m.TarefaPage })))
const Faturamento = lazy(() => import('./pages/Faturamento').then((m) => ({ default: m.Faturamento })))
const Relatorios = lazy(() => import('./pages/Relatorios').then((m) => ({ default: m.Relatorios })))

function Rotas() {
  const { session, usuario, carregando } = useAuth()
  useEffect(() => {
    // pausas com mais de 8 h são finalizadas no último horário ativo
    if (usuario) void finalizarPausasExpiradas(usuario.id).catch(() => {})
  }, [usuario])

  if (carregando) return <Carregando />
  if (!session) return <Login />
  return (
    <Suspense fallback={<Carregando />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hoje />} />
        <Route path="painel" element={<Dashboard />} />
        <Route path="projetos" element={<Projetos />} />
        <Route path="projetos/:id/:aba?" element={<ProjetoPage />} />
        <Route path="tarefas/:id" element={<TarefaPage />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="faturamento" element={<Faturamento />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
