-- ============================================================
-- Panela da Roça — Correção: consumo_churrasco.lancamento_id
-- + RPC baixar_consumo que vincula o lançamento gerado
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================

ALTER TABLE consumo_churrasco
  ADD COLUMN IF NOT EXISTS lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- baixar_consumo (atômico + vincula lançamento ao consumo)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION baixar_consumo(
  p_corte_id UUID,
  p_quantidade_kg NUMERIC,
  p_data DATE DEFAULT CURRENT_DATE,
  p_preco_kg NUMERIC DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carne RECORD;
  v_valor_total NUMERIC;
  v_lancamento_id UUID;
  v_consumo_id UUID;
  v_categoria_id UUID;
BEGIN
  IF p_corte_id IS NULL OR p_quantidade_kg IS NULL OR p_quantidade_kg <= 0 THEN
    RETURN jsonb_build_object('error', 'corte_id e quantidade_kg (>0) obrigatorios');
  END IF;

  -- Lock a linha e garante estoque suficiente de forma atômica
  UPDATE estoque_carnes
  SET quantidade_kg = ROUND((quantidade_kg - p_quantidade_kg)::numeric, 2)
  WHERE id = p_corte_id AND quantidade_kg >= p_quantidade_kg
  RETURNING * INTO v_carne;

  IF NOT FOUND THEN
    SELECT * INTO v_carne FROM estoque_carnes WHERE id = p_corte_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Carne não encontrada');
    END IF;
    RETURN jsonb_build_object('error', 'Estoque insuficiente (disponivel ' || v_carne.quantidade_kg || 'kg, solicitado ' || p_quantidade_kg || 'kg)');
  END IF;

  v_valor_total := ROUND((COALESCE(p_preco_kg, v_carne.preco_kg_compra, 0) * p_quantidade_kg)::numeric, 2);

  -- Insere o consumo
  INSERT INTO consumo_churrasco (data, corte_id, quantidade_kg, valor_total, observacao)
  VALUES (p_data, p_corte_id, p_quantidade_kg, v_valor_total, p_observacao)
  RETURNING id INTO v_consumo_id;

  -- Cria o lançamento de despesa (Carnes)
  SELECT id INTO v_categoria_id FROM categorias
  WHERE lower(nome) = 'carnes' AND tipo = 'despesa' LIMIT 1;
  IF v_categoria_id IS NULL THEN
    SELECT id INTO v_categoria_id FROM categorias WHERE tipo = 'despesa' ORDER BY nome LIMIT 1;
  END IF;

  INSERT INTO lancamentos (tipo, valor, descricao, data, categoria_id, origem, afeta_caixa, afeta_resultado, estoque_ref_id)
  VALUES ('despesa', v_valor_total, 'CONSUMO: ' || v_carne.nome || ' ' || p_quantidade_kg || 'kg', p_data,
          v_categoria_id, 'manual', false, true, p_corte_id)
  RETURNING id INTO v_lancamento_id;

  UPDATE consumo_churrasco SET lancamento_id = v_lancamento_id WHERE id = v_consumo_id;

  RETURN jsonb_build_object(
    'success', true, 'consumo_id', v_consumo_id,
    'lancamento_id', v_lancamento_id, 'estoque_atualizado', v_carne.quantidade_kg, 'valor_total', v_valor_total
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
