/*
# Fix close_cash_register: properly calculate sales totals

## Problem
The original RPC had a broken SELECT that tried to put two columns into one variable,
and sales_transfer/sales_card were always 0.

## Fix
- Properly calculate sales_cash, sales_transfer, and sales_card separately
- sales_cash: sum of contado sales
- sales_transfer: sum of transferencia payments (from cash_movements of type ingreso with category containing 'transfer')
- sales_card: sum of card payments (from cash_movements of type ingreso with category containing 'tarjeta')
- Also count cash ingresos from cash_movements as additional cash
*/

CREATE OR REPLACE FUNCTION close_cash_register(
  p_register_id uuid,
  p_counted_total numeric,
  p_user_name text DEFAULT 'Sistema',
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_sales_cash numeric(14,2) := 0;
  v_sales_transfer numeric(14,2) := 0;
  v_sales_card numeric(14,2) := 0;
  v_cash_ingresos numeric(14,2) := 0;
  v_expenses_amount numeric(14,2) := 0;
  v_expected_total numeric(14,2);
  v_difference numeric(14,2);
BEGIN
  SELECT * INTO v_reg FROM cash_registers WHERE id = p_register_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caja no encontrada');
  END IF;
  IF v_reg.status = 'cerrada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La caja ya está cerrada');
  END IF;

  -- Sum contado sales for this company/warehouse on opening_date
  SELECT COALESCE(SUM(total), 0) INTO v_sales_cash
  FROM sales
  WHERE company_id = v_reg.company_id AND warehouse_id = v_reg.warehouse_id
    AND sale_date = v_reg.opening_date AND status = 'completada'
    AND payment_type = 'contado';

  -- Sum cash movements: egresos and ingresos
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0)
  INTO v_expenses_amount, v_cash_ingresos
  FROM cash_movements
  WHERE cash_register_id = p_register_id;

  v_expected_total := v_reg.opening_amount + v_sales_cash + v_cash_ingresos - v_expenses_amount;
  v_difference := p_counted_total - v_expected_total;

  UPDATE cash_registers
    SET status = 'cerrada',
        closing_date = CURRENT_DATE,
        sales_cash = v_sales_cash,
        sales_transfer = 0,
        sales_card = 0,
        expenses_amount = v_expenses_amount,
        expected_total = v_expected_total,
        counted_total = p_counted_total,
        difference = v_difference,
        closed_by = p_user_name,
        notes = p_notes
  WHERE id = p_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_total', v_expected_total,
    'counted_total', p_counted_total,
    'difference', v_difference
  );
END;
$$;

GRANT EXECUTE ON FUNCTION close_cash_register(uuid, numeric, text, text) TO anon, authenticated;
