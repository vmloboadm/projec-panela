-- ============================================================
-- Panela da Roça — Área de funcionários
-- Cadastro de funcionários + registro de pagamentos (quinzena,
-- salário, extra) com acompanhamento do que falta pagar.
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- funcionarios
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT DEFAULT 'Funcionário',
  salario_base NUMERIC DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- funcionario_pagamentos
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funcionario_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'salario'
    CHECK (tipo = ANY (ARRAY['quinzena'::text, 'salario'::text, 'extra'::text, 'adiantamento'::text])),
  valor NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  lancamento_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funcionario_pagamentos_func ON funcionario_pagamentos(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_funcionario_pagamentos_data ON funcionario_pagamentos(data);

-- ────────────────────────────────────────────────────────────
-- Acessos (seguindo o padrão do restante do schema)
-- ────────────────────────────────────────────────────────────
ALTER TABLE funcionarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE funcionario_pagamentos DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE funcionarios TO anon, authenticated, service_role;
GRANT ALL ON TABLE funcionario_pagamentos TO anon, authenticated, service_role;
