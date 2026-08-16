-- Adicionar flags de caixa vs resultado
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS afeta_caixa BOOLEAN DEFAULT true;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS afeta_resultado BOOLEAN DEFAULT true;

-- Atualizar lançamentos existentes (todos são resultado)
UPDATE lancamentos SET afeta_caixa = true, afeta_resultado = true;
