-- Tabela de cortes de carne (estoque do churrasco)
create table if not exists estoque_carnes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_corte text not null, -- picanha, alcatra, maminha, costela, frango, etc
  quantidade_kg numeric(10,2) default 0,
  preco_kg_compra numeric(10,2) default 0,
  preco_kg_venda numeric(10,2) default 0,
  fornecedor text,
  created_at timestamptz default now()
);

-- Tabela de consumo diário de carnes
create table if not exists consumo_churrasco (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  corte_id uuid references estoque_carnes(id),
  quantidade_kg numeric(10,2) not null,
  valor_total numeric(10,2) default 0,
  observacao text,
  created_at timestamptz default now()
);

-- Tabela para fechamento diário do caixa
create table if not exists fechamento_dia (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date unique,
  vendas_dinheiro numeric(10,2) default 0,
  vendas_cartao_credito numeric(10,2) default 0,
  vendas_cartao_debito numeric(10,2) default 0,
  vendas_pix numeric(10,2) default 0,
  total_vendas numeric(10,2) default 0,
  total_despesas numeric(10,2) default 0,
  lucro_bruto numeric(10,2) default 0,
  clientes_atendidos integer default 0,
  kg_self_service numeric(10,2) default 0, -- kg de comida servida
  kg_carnes_churrasco numeric(10,2) default 0,
  fechado boolean default false,
  created_at timestamptz default now()
);

-- RLS
alter table estoque_carnes enable row level security;
alter table consumo_churrasco enable row level security;
alter table fechamento_dia enable row level security;

-- Grant service_role
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
