-- Controle de Projetos — schema do MVP (Supabase / Postgres)
-- Execute no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

-- ───────────── Tabelas ─────────────

create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  perfil text not null default 'colaborador' check (perfil in ('admin','colaborador')),
  valor_hora numeric(12,2) not null default 0,
  ativo boolean not null default true
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text,
  email text,
  telefone text,
  valor_hora_venda_padrao numeric(12,2) not null default 0
);

create table if not exists projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente_id uuid references clientes(id),
  descricao text,
  data_inicio date,
  prazo date,
  orcamento numeric(14,2) not null default 0,
  valor_hora_venda numeric(12,2),            -- null = herda do cliente
  status text not null default 'planejado'
    check (status in ('planejado','em_andamento','pausado','concluido','cancelado')),
  responsavel_id uuid references usuarios(id),
  arquivado boolean not null default false
);

create table if not exists projeto_membros (
  projeto_id uuid references projetos(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete cascade,
  primary key (projeto_id, usuario_id)
);

create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  titulo text not null,
  descricao text,
  responsavel_id uuid references usuarios(id),
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta')),
  status text not null default 'a_fazer'
    check (status in ('a_fazer','em_andamento','em_revisao','concluida')),
  prazo date,
  horas_estimadas numeric(8,2) not null default 0,
  ordem integer not null default 0
);

create table if not exists subtarefas (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  titulo text not null,
  concluida boolean not null default false
);

create table if not exists lancamentos_horas (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id),
  usuario_id uuid not null references usuarios(id),
  data date not null,
  inicio timestamptz,
  fim timestamptz,
  horas numeric(8,2) not null default 0,
  descricao text,
  valor_hora_aplicado numeric(12,2) not null default 0,   -- custo vigente no lançamento
  valor_venda_aplicado numeric(12,2) not null default 0,  -- venda vigente no lançamento
  faturavel boolean not null default true,
  faturado_em date,
  origem text not null default 'manual' check (origem in ('cronometro','manual')),
  estado text not null default 'finalizado' check (estado in ('rodando','pausado','finalizado'))
);

create table if not exists intervalos_tempo (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references lancamentos_horas(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz
);

create table if not exists categorias_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);
insert into categorias_custo (nome) values
  ('Material'),('Serviço terceiro'),('Software/Licença'),('Deslocamento'),('Outros')
on conflict do nothing;

create table if not exists custos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id),
  tarefa_id uuid references tarefas(id),
  usuario_id uuid references usuarios(id),
  data date not null,
  descricao text not null,
  categoria text not null,
  valor numeric(14,2) not null,
  fornecedor text,
  situacao text not null default 'realizado' check (situacao in ('previsto','realizado')),
  comprovante_url text,                       -- caminho no bucket "comprovantes"
  repassar_cliente boolean not null default false
);

create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id),
  texto text not null,
  data timestamptz not null default now()
);

create table if not exists anexos (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  nome text not null,
  caminho text not null,                      -- caminho no bucket "anexos"
  usuario_id uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

-- Configurações da empresa (logo do relatório do cliente)
create table if not exists configuracoes (
  id integer primary key default 1 check (id = 1),
  empresa_nome text,
  logo_data text                              -- data URL (png/jpg)
);
insert into configuracoes (id) values (1) on conflict do nothing;

create index if not exists idx_tarefas_projeto on tarefas(projeto_id);
create index if not exists idx_horas_tarefa on lancamentos_horas(tarefa_id);
create index if not exists idx_horas_usuario_estado on lancamentos_horas(usuario_id, estado);
create index if not exists idx_custos_projeto on custos(projeto_id);
create index if not exists idx_intervalos_lanc on intervalos_tempo(lancamento_id);

-- ───────────── Funções de acesso ─────────────

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select perfil = 'admin' and ativo from usuarios where id = auth.uid()), false)
$$;

create or replace function pode_acessar_projeto(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin()
      or exists (select 1 from projeto_membros where projeto_id = pid and usuario_id = auth.uid())
      or exists (select 1 from projetos where id = pid and responsavel_id = auth.uid())
$$;

create or replace function projeto_da_tarefa(tid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select projeto_id from tarefas where id = tid
$$;

-- Primeiro usuário cadastrado vira admin; os demais, colaboradores.
create or replace function novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from usuarios) then 'colaborador' else 'admin' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function novo_usuario();

-- ───────────── Regras de negócio no banco ─────────────

-- Projeto concluído/cancelado bloqueia novos lançamentos (exceto admin).
create or replace function bloqueia_projeto_fechado() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid; st text;
begin
  if tg_table_name = 'custos' then pid := new.projeto_id;
  else pid := projeto_da_tarefa(new.tarefa_id);
  end if;
  select status into st from projetos where id = pid;
  if st in ('concluido','cancelado') and not is_admin() then
    raise exception 'Projeto % está %: novos lançamentos bloqueados.', pid, st;
  end if;
  return new;
end $$;

drop trigger if exists trg_horas_projeto_fechado on lancamentos_horas;
create trigger trg_horas_projeto_fechado before insert on lancamentos_horas
  for each row execute function bloqueia_projeto_fechado();
drop trigger if exists trg_custos_projeto_fechado on custos;
create trigger trg_custos_projeto_fechado before insert on custos
  for each row execute function bloqueia_projeto_fechado();

-- Projeto com lançamentos não é excluído, apenas arquivado.
create or replace function protege_projeto_com_lancamentos() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from lancamentos_horas h join tarefas t on t.id = h.tarefa_id where t.projeto_id = old.id)
     or exists (select 1 from custos where projeto_id = old.id) then
    raise exception 'Projeto com lançamentos não pode ser excluído; arquive-o.';
  end if;
  return old;
end $$;

drop trigger if exists trg_protege_projeto on projetos;
create trigger trg_protege_projeto before delete on projetos
  for each row execute function protege_projeto_com_lancamentos();

-- Um único cronômetro "rodando" por usuário.
create unique index if not exists uq_um_cronometro_rodando
  on lancamentos_horas (usuario_id) where estado = 'rodando';

-- ───────────── RLS ─────────────

alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table projetos enable row level security;
alter table projeto_membros enable row level security;
alter table tarefas enable row level security;
alter table subtarefas enable row level security;
alter table lancamentos_horas enable row level security;
alter table intervalos_tempo enable row level security;
alter table categorias_custo enable row level security;
alter table custos enable row level security;
alter table comentarios enable row level security;
alter table anexos enable row level security;
alter table configuracoes enable row level security;

-- usuarios: todos autenticados leem; admin altera; cada um altera o próprio nome.
drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios for select to authenticated using (true);
drop policy if exists usuarios_admin on usuarios;
create policy usuarios_admin on usuarios for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists clientes_all on clientes;
create policy clientes_all on clientes for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists clientes_select on clientes;
create policy clientes_select on clientes for select to authenticated using (true);

drop policy if exists projetos_select on projetos;
create policy projetos_select on projetos for select to authenticated using (pode_acessar_projeto(id));
drop policy if exists projetos_write on projetos;
create policy projetos_write on projetos for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists membros_select on projeto_membros;
create policy membros_select on projeto_membros for select to authenticated using (pode_acessar_projeto(projeto_id));
drop policy if exists membros_write on projeto_membros;
create policy membros_write on projeto_membros for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists tarefas_all on tarefas;
create policy tarefas_all on tarefas for all to authenticated
  using (pode_acessar_projeto(projeto_id)) with check (pode_acessar_projeto(projeto_id));
drop policy if exists subtarefas_all on subtarefas;
create policy subtarefas_all on subtarefas for all to authenticated
  using (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)))
  with check (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)));
drop policy if exists comentarios_all on comentarios;
create policy comentarios_all on comentarios for all to authenticated
  using (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)))
  with check (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)));
drop policy if exists anexos_all on anexos;
create policy anexos_all on anexos for all to authenticated
  using (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)))
  with check (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)));

-- Horas: lê quem acessa o projeto; edita/exclui só o dono (admin edita todos).
drop policy if exists horas_select on lancamentos_horas;
create policy horas_select on lancamentos_horas for select to authenticated
  using (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)));
drop policy if exists horas_insert on lancamentos_horas;
create policy horas_insert on lancamentos_horas for insert to authenticated
  with check (pode_acessar_projeto(projeto_da_tarefa(tarefa_id)) and (usuario_id = auth.uid() or is_admin()));
drop policy if exists horas_update on lancamentos_horas;
create policy horas_update on lancamentos_horas for update to authenticated
  using (usuario_id = auth.uid() or is_admin());
drop policy if exists horas_delete on lancamentos_horas;
create policy horas_delete on lancamentos_horas for delete to authenticated
  using (usuario_id = auth.uid() or is_admin());

drop policy if exists intervalos_all on intervalos_tempo;
create policy intervalos_all on intervalos_tempo for all to authenticated
  using (exists (select 1 from lancamentos_horas h where h.id = lancamento_id
                 and (h.usuario_id = auth.uid() or is_admin())))
  with check (exists (select 1 from lancamentos_horas h where h.id = lancamento_id
                 and (h.usuario_id = auth.uid() or is_admin())));
drop policy if exists intervalos_select on intervalos_tempo;
create policy intervalos_select on intervalos_tempo for select to authenticated
  using (exists (select 1 from lancamentos_horas h where h.id = lancamento_id
                 and pode_acessar_projeto(projeto_da_tarefa(h.tarefa_id))));

drop policy if exists categorias_select on categorias_custo;
create policy categorias_select on categorias_custo for select to authenticated using (true);
drop policy if exists categorias_write on categorias_custo;
create policy categorias_write on categorias_custo for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists custos_all on custos;
create policy custos_all on custos for all to authenticated
  using (pode_acessar_projeto(projeto_id)) with check (pode_acessar_projeto(projeto_id));

drop policy if exists config_select on configuracoes;
create policy config_select on configuracoes for select to authenticated using (true);
drop policy if exists config_write on configuracoes;
create policy config_write on configuracoes for all to authenticated
  using (is_admin()) with check (is_admin());

-- ───────────── Storage ─────────────

insert into storage.buckets (id, name, public)
values ('comprovantes','comprovantes', false), ('anexos','anexos', false)
on conflict do nothing;

drop policy if exists storage_rw on storage.objects;
create policy storage_rw on storage.objects for all to authenticated
  using (bucket_id in ('comprovantes','anexos'))
  with check (bucket_id in ('comprovantes','anexos'));

-- ───────────── Fase 2: faturamento, recebimentos e valor fixo ─────────────

alter table projetos add column if not exists tipo_cobranca text not null default 'hora'
  check (tipo_cobranca in ('hora','fixo'));
alter table projetos add column if not exists valor_fixo numeric(14,2);

create table if not exists faturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  projeto_id uuid references projetos(id),      -- preenchido em fatura avulsa de projeto fixo
  descricao text,
  emitida_em date not null default current_date,
  vencimento date not null,
  valor numeric(14,2) not null check (valor >= 0),
  pago_em date,
  valor_pago numeric(14,2)
);
create index if not exists idx_faturas_cliente on faturas(cliente_id);

alter table lancamentos_horas add column if not exists fatura_id uuid references faturas(id) on delete set null;
alter table custos add column if not exists faturado_em date;
alter table custos add column if not exists fatura_id uuid references faturas(id) on delete set null;

alter table faturas enable row level security;
drop policy if exists faturas_all on faturas;
create policy faturas_all on faturas for all to authenticated
  using (is_admin()) with check (is_admin());
