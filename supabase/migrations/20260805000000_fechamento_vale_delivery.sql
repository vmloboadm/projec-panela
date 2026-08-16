-- ============================================================
-- Panela da Roça — Correção: colunas vale refeição e delivery
-- no fechamento do dia + RPC fechar_dia atualizada
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================

ALTER TABLE fechamento_dia
  ADD COLUMN IF NOT EXISTS vendas_vale_refeicao NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendas_delivery NUMERIC DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- fechar_dia (atômico + fundo de caixa + vale/delivery)
-- dif = caixa_contado - (fundo_caixa + vendas_dinheiro)
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
  p_observacoes TEXT DEFAULT NULL,
  p_fundo_caixa NUMERIC DEFAULT 0,
  p_caixa_contado NUMERIC DEFAULT 0,
  p_vendas_vale_refeicao NUMERIC DEFAULT 0,
  p_vendas_delivery NUMERIC DEFAULT 0
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
  v_fechamento_id UUID;
  v_esperado_caixa NUMERIC;
  v_diferenca_caixa NUMERIC;
BEGIN
  v_total := COALESCE(p_total_vendas, ROUND((p_vendas_dinheiro + p_vendas_cartao_credito + p_vendas_cartao_debito + p_vendas_pix + COALESCE(p_vendas_vale_refeicao, 0) + COALESCE(p_vendas_delivery, 0))::numeric, 2));
  v_lucro := COALESCE(p_lucro_bruto, ROUND((v_total - p_total_despesas)::numeric, 2));

  v_esperado_caixa := ROUND((COALESCE(p_fundo_caixa, 0) + COALESCE(p_vendas_dinheiro, 0))::numeric, 2);
  v_diferenca_caixa := ROUND((COALESCE(p_caixa_contado, 0) - v_esperado_caixa)::numeric, 2);

  INSERT INTO fechamento_dia (data, vendas_dinheiro, vendas_cartao_credito, vendas_cartao_debito, vendas_pix,
                              vendas_vale_refeicao, vendas_delivery,
                              total_vendas, total_despesas, lucro_bruto, clientes_atendidos,
                              kg_self_service, kg_carnes_churrasco, observacoes, fechado,
                              fundo_caixa, caixa_contado, diferenca_caixa)
  VALUES (p_data, p_vendas_dinheiro, p_vendas_cartao_credito, p_vendas_cartao_debito, p_vendas_pix,
          COALESCE(p_vendas_vale_refeicao, 0), COALESCE(p_vendas_delivery, 0),
          v_total, p_total_despesas, v_lucro, p_clientes_atendidos,
          p_kg_self_service, p_kg_carnes_churrasco, p_observacoes, true,
          COALESCE(p_fundo_caixa, 0), COALESCE(p_caixa_contado, 0), v_diferenca_caixa)
  ON CONFLICT (data) DO UPDATE SET
    vendas_dinheiro = EXCLUDED.vendas_dinheiro,
    vendas_cartao_credito = EXCLUDED.vendas_cartao_credito,
    vendas_cartao_debito = EXCLUDED.vendas_cartao_debito,
    vendas_pix = EXCLUDED.vendas_pix,
    vendas_vale_refeicao = EXCLUDED.vendas_vale_refeicao,
    vendas_delivery = EXCLUDED.vendas_delivery,
    total_vendas = EXCLUDED.total_vendas,
    total_despesas = EXCLUDED.total_despesas,
    lucro_bruto = EXCLUDED.lucro_bruto,
    clientes_atendidos = EXCLUDED.clientes_atendidos,
    kg_self_service = EXCLUDED.kg_self_service,
    kg_carnes_churrasco = EXCLUDED.kg_carnes_churrasco,
    observacoes = EXCLUDED.observacoes,
    fechado = true,
    fundo_caixa = EXCLUDED.fundo_caixa,
    caixa_contado = EXCLUDED.caixa_contado,
    diferenca_caixa = EXCLUDED.diferenca_caixa
  RETURNING id INTO v_fechamento_id;

  DELETE FROM lancamentos WHERE origem = 'fechamento' AND data = p_data;

  SELECT id INTO v_categoria_id FROM categorias
  WHERE lower(nome) LIKE 'vendas%' AND tipo = 'receita' LIMIT 1;

  INSERT INTO lancamentos (tipo, valor, descricao, data, categoria_id, origem, afeta_caixa, afeta_resultado)
  VALUES ('receita', v_total, 'Fechamento do dia', p_data, v_categoria_id, 'fechamento', true, true)
  RETURNING id INTO v_lancamento_id;

  RETURN jsonb_build_object('success', true, 'fechamento_id', v_fechamento_id, 'lancamento_id', v_lancamento_id,
    'total_vendas', v_total, 'lucro_bruto', v_lucro,
    'fundo_caixa', COALESCE(p_fundo_caixa, 0), 'caixa_contado', COALESCE(p_caixa_contado, 0),
    'esperado_caixa', v_esperado_caixa, 'diferenca_caixa', v_diferenca_caixa);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
