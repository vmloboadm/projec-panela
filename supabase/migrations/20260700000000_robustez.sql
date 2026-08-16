-- ============================================================
-- Panela da Roça — Robustez (Áreas 1, 3, 5)
-- RPCs atômicas + índices
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ÁREA 1 + 3: pagar_conta (atômico + lock)
-- Atualiza contas_a_pagar + insere lançamento em UMA transação
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pagar_conta(
  p_conta_id UUID,
  p_descricao TEXT,
  p_valor NUMERIC DEFAULT NULL,
  p_data DATE DEFAULT CURRENT_DATE,
  p_metodo_pagamento TEXT DEFAULT NULL,
  p_multa NUMERIC DEFAULT 0,
  p_juros NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta RECORD;
  v_valor_pago NUMERIC;
  v_lancamento_id UUID;
  v_metodo TEXT;
BEGIN
  -- Lock a linha (concorrência)
  SELECT * INTO v_conta
  FROM contas_a_pagar
  WHERE id = p_conta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Conta não encontrada');
  END IF;

  IF v_conta.status = 'pago' THEN
    RETURN jsonb_build_object('error', 'Conta já foi paga');
  END IF;

  v_valor_pago := ROUND((COALESCE(p_valor, v_conta.valor, 0) + COALESCE(p_multa, 0) + COALESCE(p_juros, 0))::numeric, 2);
  v_metodo := COALESCE(p_metodo_pagamento, v_conta.metodo_pagamento, 'dinheiro');

  -- Insere lançamento
  INSERT INTO lancamentos (tipo, valor, descricao, data, categoria_id, origem, metodo_pagamento, afeta_caixa, afeta_resultado)
  VALUES ('despesa', v_valor_pago, 'PAGAMENTO: ' || COALESCE(p_descricao, v_conta.descricao), p_data,
          v_conta.categoria_id, 'manual', v_metodo, true, true)
  RETURNING id INTO v_lancamento_id;

  -- Atualiza a conta
  UPDATE contas_a_pagar
  SET status = 'pago', lancamento_id = v_lancamento_id, data_pagamento = p_data,
      metodo_pagamento = v_metodo, multa = COALESCE(p_multa, 0), juros = COALESCE(p_juros, 0),
      valor_pago = v_valor_pago
  WHERE id = p_conta_id;

  RETURN jsonb_build_object('success', true, 'lancamento_id', v_lancamento_id, 'conta_id', p_conta_id, 'valor_pago', v_valor_pago);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- ÁREA 1 + 3: baixar_consumo (atômico + lock + estoque >= kg)
-- Atualiza estoque + insere consumo_churrasco + lançamento
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION baixar_consumo(
  p_corte_id UUID,
  p_quantidade_kg NUMERIC,
  p_data DATE DEFAULT CURRENT_DATE,
  p_observacao TEXT DEFAULT NULL,
  p_preco_kg NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_carne RECORD;
  v_valor_total NUMERIC;
  v_lancamento_id UUID;
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
  VALUES (p_data, p_corte_id, p_quantidade_kg, v_valor_total, p_observacao);

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

  RETURN jsonb_build_object(
    'success', true, 'consumo_id', (SELECT id FROM consumo_churrasco WHERE corte_id = p_corte_id AND data = p_data ORDER BY created_at DESC LIMIT 1),
    'lancamento_id', v_lancamento_id, 'estoque_atualizado', v_carne.quantidade_kg, 'valor_total', v_valor_total
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- ÁREA 1: fechar_dia (atômico: fechamento + lançamento receita)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fechar_dia(
  p_data DATE DEFAULT CURRENT_DATE,
  p_vendas_dinheiro NUMERIC DEFAULT 0,
  p_vendas_cartao_credito NUMERIC DEFAULT 0,
  p_vendas_cartao_debito NUMERIC DEFAULT 0,
  p_vendas_pix NUMERIC DEFAULT 0,
  p_total_vendas NUMERIC DEFAULT NULL,
  p_total_despesas NUMERIC DEFAULT 0,
  p_lucro_bruto NUMERIC DEFAULT NULL,
  p_clientes_atendidos INTEGER DEFAULT 0,
  p_kg_self_service NUMERIC DEFAULT 0,
  p_kg_carnes_churrasco NUMERIC DEFAULT 0,
  p_observacoes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_lucro NUMERIC;
  v_lancamento_id UUID;
  v_categoria_id UUID;
BEGIN
  v_total := COALESCE(p_total_vendas, ROUND((p_vendas_dinheiro + p_vendas_cartao_credito + p_vendas_cartao_debito + p_vendas_pix)::numeric, 2));
  v_lucro := COALESCE(p_lucro_bruto, ROUND((v_total - p_total_despesas)::numeric, 2));

  -- Upsert fechamento (data é unique)
  INSERT INTO fechamento_dia (data, vendas_dinheiro, vendas_cartao_credito, vendas_cartao_debito, vendas_pix,
                              total_vendas, total_despesas, lucro_bruto, clientes_atendidos,
                              kg_self_service, kg_carnes_churrasco, observacoes, fechado)
  VALUES (p_data, p_vendas_dinheiro, p_vendas_cartao_credito, p_vendas_cartao_debito, p_vendas_pix,
          v_total, p_total_despesas, v_lucro, p_clientes_atendidos,
          p_kg_self_service, p_kg_carnes_churrasco, p_observacoes, true)
  ON CONFLICT (data) DO UPDATE SET
    vendas_dinheiro = EXCLUDED.vendas_dinheiro,
    vendas_cartao_credito = EXCLUDED.vendas_cartao_credito,
    vendas_cartao_debito = EXCLUDED.vendas_cartao_debito,
    vendas_pix = EXCLUDED.vendas_pix,
    total_vendas = EXCLUDED.total_vendas,
    total_despesas = EXCLUDED.total_despesas,
    lucro_bruto = EXCLUDED.lucro_bruto,
    clientes_atendidos = EXCLUDED.clientes_atendidos,
    kg_self_service = EXCLUDED.kg_self_service,
    kg_carnes_churrasco = EXCLUDED.kg_carnes_churrasco,
    observacoes = EXCLUDED.observacoes,
    fechado = true;

  -- Remove lançamentos antigos de fechamento do dia (re-gravar)
  DELETE FROM lancamentos WHERE origem = 'fechamento' AND data = p_data;

  SELECT id INTO v_categoria_id FROM categorias
  WHERE lower(nome) LIKE 'vendas%' AND tipo = 'receita' LIMIT 1;

  INSERT INTO lancamentos (tipo, valor, descricao, data, categoria_id, origem, afeta_caixa, afeta_resultado)
  VALUES ('receita', v_total, 'Fechamento do dia', p_data, v_categoria_id, 'fechamento', true, true)
  RETURNING id INTO v_lancamento_id;

  RETURN jsonb_build_object('success', true, 'fechamento_id', (SELECT id FROM fechamento_dia WHERE data = p_data), 'lancamento_id', v_lancamento_id, 'total_vendas', v_total, 'lucro_bruto', v_lucro);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- ÁREA 5: Índices de performance
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos (data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos (tipo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos (categoria_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_tipo ON lancamentos (data, tipo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_deleted ON lancamentos (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON contas_a_pagar (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_a_pagar (status);
CREATE INDEX IF NOT EXISTS idx_estoque_carnes_nome ON estoque_carnes (nome);
CREATE INDEX IF NOT EXISTS idx_consumo_churrasco_data ON consumo_churrasco (data);
CREATE INDEX IF NOT EXISTS idx_consumo_churrasco_corte ON consumo_churrasco (corte_id);
CREATE INDEX IF NOT EXISTS idx_consumo_churrasco_data_corte ON consumo_churrasco (data, corte_id);
CREATE INDEX IF NOT EXISTS idx_fechamento_data ON fechamento_dia (data);
