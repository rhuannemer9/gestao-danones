create table if not exists fornecedores (
  id bigint primary key,
  nome text not null,
  contato text default '',
  observacoes text default '',
  criado_em timestamptz default now(),
  ativo boolean default true
);

create table if not exists compras_fornecedores (
  id bigint primary key,
  sync_id text unique,
  fornecedor_id bigint,
  fornecedor_nome text not null,
  produto_id bigint,
  produto_nome text not null,
  quantidade numeric default 0,
  valor_total numeric default 0,
  valor_pago numeric default 0,
  saldo_restante numeric default 0,
  status text default 'Pendente',
  forma_pagamento text default 'Nao informado',
  data_compra timestamptz default now(),
  vencimento date,
  observacao text default '',
  atualizou_estoque boolean default false,
  lancou_caixa boolean default false,
  caixa_sync_id text,
  ativo boolean default true
);

create index if not exists idx_fornecedores_ativo
  on fornecedores (ativo);

create index if not exists idx_compras_fornecedores_ativo_data
  on compras_fornecedores (ativo, data_compra desc);

create index if not exists idx_compras_fornecedores_fornecedor
  on compras_fornecedores (fornecedor_id);

