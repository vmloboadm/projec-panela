-- Contas onde o dinheiro fica (dinheiro físico, Pix, cartão, banco)
create table contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('dinheiro','pix','cartao','banco')),
  saldo_inicial numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

-- Categorias de receita/despesa
create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('receita','despesa')),
  grupo text check (grupo in ('insumos','producao','manutencao','variavel','fixa')),
  created_at timestamptz default now()
);

-- Lançamentos (receita e despesa já efetivados)
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita','despesa')),
  valor numeric(12,2) not null,
  categoria_id uuid references categorias(id),
  conta_id uuid references contas(id),
  data date not null,
  descricao text,
  comprovante_url text,
  origem text not null check (origem in ('manual','ia_foto','ia_audio','ia_prompt','ia_boleto')),
  estoque_ref_id uuid,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contas a pagar (despesas fixas com vencimento)
create table contas_a_pagar (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id),
  descricao text not null,
  valor numeric(12,2),
  valor_fixo boolean not null default true,
  recorrente boolean not null default true,
  dia_vencimento int not null,
  data_vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente','pago','atrasado')),
  data_pagamento date,
  lancamento_id uuid references lancamentos(id),
  created_at timestamptz default now()
);

-- Fila de sugestões da IA aguardando confirmação do usuário
create table ia_pendencias (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('foto','audio','prompt','boleto')),
  payload_bruto jsonb,
  sugestao jsonb not null,
  status text not null default 'aguardando' check (status in ('aguardando','confirmado','rejeitado')),
  lancamento_id uuid references lancamentos(id),
  created_at timestamptz default now()
);

-- Configuração do sistema
create table configuracao (
  id uuid primary key default gen_random_uuid(),
  nome_restaurante text,
  logo_url text,
  endereco text,
  created_at timestamptz default now()
);