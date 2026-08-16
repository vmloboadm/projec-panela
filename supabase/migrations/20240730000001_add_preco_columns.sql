-- Adicionar preco_carne_padrao_kg na configuracao
ALTER TABLE configuracao ADD COLUMN IF NOT EXISTS preco_carne_padrao_kg NUMERIC(10,2) DEFAULT 0;

-- Garantir registro padrao com UUID fixo
INSERT INTO configuracao (id, nome_restaurante, aluguel_mensal, funcionarios_mensal, energia_mensal, agua_mensal, outros_fixos, tolerancia_caixa, preco_carne_padrao_kg)
VALUES ('00000000-0000-0000-0000-000000000001', 'Panela da Roça', 0, 0, 0, 0, 0, 10, 0)
ON CONFLICT (id) DO UPDATE SET preco_carne_padrao_kg = COALESCE(configuracao.preco_carne_padrao_kg, 0);

-- Adicionar preco_kg na estoque_carnes
ALTER TABLE estoque_carnes ADD COLUMN IF NOT EXISTS preco_kg NUMERIC(10,2) DEFAULT 0;
