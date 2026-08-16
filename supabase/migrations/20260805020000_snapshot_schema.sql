-- ============================================================
-- Panela da Roça — Snapshot do schema real (divergências que
-- foram aplicadas fora do diretório de migrações).
-- Idempotente: pode rodar quantas vezes quiser.
-- Garante que um deploy fresco produza o schema de produção.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- lancamentos: constraint de origem com todos os valores usados
-- ────────────────────────────────────────────────────────────
ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_origem_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_origem_check
  CHECK (origem = ANY (ARRAY['manual'::text, 'ia'::text, 'ia_foto'::text, 'ia_audio'::text, 'ia_prompt'::text, 'ia_boleto'::text, 'importacao_csv'::text, 'conta_a_pagar'::text, 'fechamento'::text, 'consumo'::text]));

-- ────────────────────────────────────────────────────────────
-- lancamentos: colunas extras (metodo_pagamento)
-- ────────────────────────────────────────────────────────────
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;

-- ────────────────────────────────────────────────────────────
-- contas_a_pagar: colunas extras
-- ────────────────────────────────────────────────────────────
ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS fornecedor TEXT,
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'Outro',
  ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS multa NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS juros NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC;

-- ────────────────────────────────────────────────────────────
-- estoque_carnes: colunas extras
-- ────────────────────────────────────────────────────────────
ALTER TABLE estoque_carnes
  ADD COLUMN IF NOT EXISTS preco_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS estoque_minimo_kg NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- ────────────────────────────────────────────────────────────
-- consumo_churrasco: vínculo com lançamento
-- ────────────────────────────────────────────────────────────
ALTER TABLE consumo_churrasco
  ADD COLUMN IF NOT EXISTS lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- fechamento_dia: colunas de vale refeição e delivery
-- ────────────────────────────────────────────────────────────
ALTER TABLE fechamento_dia
  ADD COLUMN IF NOT EXISTS vendas_vale_refeicao NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendas_delivery NUMERIC DEFAULT 0;
