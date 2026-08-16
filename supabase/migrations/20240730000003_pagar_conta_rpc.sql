CREATE OR REPLACE FUNCTION pagar_conta(
  p_conta_id UUID,
  p_descricao TEXT,
  p_valor NUMERIC,
  p_data DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lancamento_id UUID;
  v_conta RECORD;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT * INTO v_conta FROM contas_a_pagar WHERE id = p_conta_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Conta não encontrada');
  END IF;
  
  IF v_conta.status = 'pago' THEN
    RETURN jsonb_build_object('error', 'Conta já foi paga');
  END IF;

  -- Create the lancamento
  INSERT INTO lancamentos (tipo, valor, descricao, data, categoria_id, origem, afeta_caixa, afeta_resultado)
  VALUES (
    'despesa',
    p_valor,
    'PAGAMENTO: ' || p_descricao,
    p_data,
    (SELECT id FROM categorias WHERE nome = 'Contas a Pagar' LIMIT 1),
    'manual',
    true,
    true
  )
  RETURNING id INTO v_lancamento_id;

  -- Update the conta status
  UPDATE contas_a_pagar
  SET status = 'pago', lancamento_id = v_lancamento_id
  WHERE id = p_conta_id;

  RETURN jsonb_build_object(
    'success', true,
    'lancamento_id', v_lancamento_id,
    'conta_id', p_conta_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
