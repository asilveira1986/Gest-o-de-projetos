# Controle de Projetos

Sistema web (MVP, uso individual) para acompanhar projetos, tarefas, horas e custos, com painel de orçamento, cobrança por hora e relatório em PDF para o cliente.

**Stack:** React + Vite + Tailwind · Supabase (Postgres, Auth, Storage) · Recharts · SheetJS · jsPDF.

## Como rodar

1. Crie um projeto no [Supabase](https://supabase.com) e execute `supabase/schema.sql` no SQL Editor (o script pode ser reexecutado; ao atualizar o sistema, rode-o de novo para aplicar as novas tabelas/colunas).
2. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`
4. Na tela de login, **crie sua conta**: o primeiro usuário vira administrador automaticamente.
5. Em *Configurações*, defina seu valor/hora (custo) e, se quiser, o logo do relatório do cliente.

Outros comandos: `npm test` (regras de cálculo), `npm run build`.
Deploy: Vercel/Railway apontando para este repositório, com as duas variáveis de ambiente.

## O que está implementado

| Área | Detalhes |
|---|---|
| Projetos | cadastro completo, status, membros, responsável, arquivar; excluir só sem lançamentos (trigger no banco) |
| Tarefas | Kanban com arrastar e soltar ⇄ lista, filtros (responsável, status, prioridade, prazo), checklist, comentários, anexos |
| Tempo | Iniciar / Pausar / Retomar / Parar na tarefa; cronômetro no topo; contagem pelos horários gravados (continua com o navegador fechado); histórico de sessões; lançamento manual; edição/exclusão |
| Custos | categorias editáveis, previsto/realizado, fornecedor, vínculo a tarefa, comprovante (foto/PDF), "repassar ao cliente" |
| Painel | orçamento × gasto × saldo × %, horas estimadas × realizadas, tarefas por status/atrasadas, alerta amarelo ≥ 80 % e vermelho > 100 %, gráfico de gasto acumulado |
| Cobrança | clientes com valor/hora de venda, projeto herda (ou ajusta), horas faturáveis/não, "faturado em", receita/custo/margem por projeto e cliente |
| Relatórios | por projeto e período → Excel, CSV, PDF; PDF do cliente (logo, tarefas, horas por tarefa, total) sem custo interno nem margem |
| Faturamento | tela "A faturar" por cliente (horas faturáveis + custos repassados), geração de fatura que marca os itens como faturados, vencimento, registro de pagamento, indicadores de a receber / vencido / recebido no mês |
| Valor fixo | projeto pode ser cobrado por hora ou por valor fechado; receita = valor fixo (+ repasses) e o resumo mostra a receita por hora efetiva; fatura avulsa para projetos fixos |
| Busca | `Ctrl/⌘ + K`: páginas, ações (lançar hora/custo), projetos e tarefas |
| Atalho | botão flutuante "+" em todas as telas para lançar hora ou custo |

### Regras de negócio

Cálculos em `src/lib/calc.ts` (testados em `calc.test.ts`): custo total, saldo, % consumido, custo projetado, receita, margem, progresso, atraso.
No cronômetro (`src/lib/timer.ts`): um único cronômetro rodando por vez (iniciar outra tarefa pausa a atual); pausas não contam; pausado há mais de 8 h é finalizado no último horário ativo; lançamentos acima de 12 h/dia pedem confirmação; `valor_hora_aplicado` e `valor_venda_aplicado` congelam o valor vigente no lançamento.
Projeto concluído/cancelado bloqueia novos lançamentos, exceto para o admin (trigger no banco + aviso na tela).

## Notas e limites do MVP

- Colaboradores (RLS por projeto/membro) já estão modelados no banco, mas a tela de convite de usuários fica para a fase seguinte; por ora, novos usuários se cadastram sozinhos e o admin ajusta perfil/valor/hora em Configurações.
- Horas de cronômetros ainda abertos entram nos totais apenas quando pausadas ou paradas.
- Fora do escopo: Gantt, emissão de notas, portal do cliente, app nativo, notificações, modelos de projeto, multi-empresa.
