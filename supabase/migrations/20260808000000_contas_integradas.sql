-- ============================================================
-- Panela da Roça — Contas a Pagar integradas
-- Boletos de mercadoria a prazo (15/20/30 dias):
--  - conta a pagar controla vencimento/fluxo futuro
--  - despesa é contabilizada UMA vez (na compra ou no pagamento)
--  - afeta_caixa decidido pelo método de pagamento (dinheiro=true, banco=false)
-- Idempotente.
-- ============================================================

ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS ja_lancada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS afeta_caixa BOOLEAN;

-- ────────────────────────────────────────────────────────────
-- pagar_conta v3: sem duplicação + afeta_caixa pelo método
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
  v_afeta_caixa BOOLEAN;
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

  -- afeta_caixa: prioridade = config explícita da conta, senão método
  IF v_conta.afeta_caixa IS NOT NULL THEN
    v_afeta_caixa := v_conta.afeta_caixa;
  ELSE
    v_afeta_caixa := (v_metodo = 'dinheiro');
  END IF;

  -- Só cria a despesa se o custo ainda NÃO foi contabilizado
  IF v_conta.ja_lancada OR v_conta.lancamento_id IS NOT NULL THEN
    v_lancamento_id := v_conta.lancamento_id;
  ELSE
    INSERT INTO lancamentos (tipo, valor, descricao, data, categoria_id, origem, metodo_pagamento, afeta_caixa, afeta_resultado)
    VALUES ('despesa', v_valor_pago, 'PAGAMENTO: ' || COALESCE(p_descricao, v_conta.descricao), p_data,
            v_conta.categoria_id, 'manual', v_metodo, v_afeta_caixa, true)
    RETURNING id INTO v_lancamento_id;
  END IF;

  -- Atualiza a conta
  UPDATE contas_a_pagar
  SET status = 'pago', lancamento_id = v_lancamento_id, data_pagamento = p_data,
      metodo_pagamento = v_metodo, multa = COALESCE(p_multa, 0), juros = COALESCE(p_juros, 0),
      valor_pago = v_valor_pago, afeta_caixa = v_afeta_caixa
  WHERE id = p_conta_id;

  RETURN jsonb_build_object('success', true, 'lancamento_id', v_lancamento_id, 'conta_id', p_conta_id, 'valor_pago', v_valor_pago, 'afeta_caixa', v_afeta_caixa, 'despesa_criada', v_conta.ja_lancada IS NOT TRUE AND v_conta.lancamento_id IS NULL);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
