/*
# Grupo JYC — Extension: Handshake Transfers, Supply Requests, POS/Cash, Mermas, Recipes

Adds the missing ERP features without modifying existing tables or logic:
1. transfer_requests — two-step handshake (Despacho -> En Transito -> Recepcion)
2. supply_requests — branch requests to Finpollo for abastecimiento
3. cash_registers — daily POS cash register with cuadre de caja
4. cash_movements — ingresos/egresos within a cash register turn
5. recipes — portion-based inventory deduction for retail (e.g. 1 paquete -> X porciones)
6. ALTER movements type constraint to add 'merma'
7. RPCs for dispatch, receive, supply request lifecycle, cash register, merma registration
*/

-- ============ ADD 'merma' TO MOVEMENTS TYPE ============
ALTER TABLE movements DROP CONSTRAINT IF EXISTS movements_type_check;
ALTER TABLE movements ADD CONSTRAINT movements_type_check
  CHECK (type IN ('entrada','salida','transferencia','compra','venta','devolucion','ajuste','merma'));

-- ============ TRANSFER REQUESTS (Handshake) ============
CREATE TABLE IF NOT EXISTS transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  origin_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  dest_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','despachada','en_transito','recibida','anulada')),
  requested_by text NOT NULL DEFAULT 'Sistema',
  dispatched_by text,
  received_by text,
  dispatch_date date,
  reception_date date,
  observations text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_transfer_requests" ON transfer_requests;
CREATE POLICY "anon_select_transfer_requests" ON transfer_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transfer_requests" ON transfer_requests;
CREATE POLICY "anon_insert_transfer_requests" ON transfer_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transfer_requests" ON transfer_requests;
CREATE POLICY "anon_update_transfer_requests" ON transfer_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transfer_requests" ON transfer_requests;
CREATE POLICY "anon_delete_transfer_requests" ON transfer_requests FOR DELETE TO anon, authenticated USING (true);

-- ============ SUPPLY REQUESTS (Branch -> Finpollo) ============
CREATE TABLE IF NOT EXISTS supply_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  requestor_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requestor_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  supplier_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada','aprobada','despachada','recibida','rechazada')),
  requested_by text NOT NULL DEFAULT 'Sistema',
  reviewed_by text,
  notes text,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  approved_date date,
  dispatch_date date,
  reception_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_supply_requests" ON supply_requests;
CREATE POLICY "anon_select_supply_requests" ON supply_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_supply_requests" ON supply_requests;
CREATE POLICY "anon_insert_supply_requests" ON supply_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_supply_requests" ON supply_requests;
CREATE POLICY "anon_update_supply_requests" ON supply_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_supply_requests" ON supply_requests;
CREATE POLICY "anon_delete_supply_requests" ON supply_requests FOR DELETE TO anon, authenticated USING (true);

-- ============ CASH REGISTERS (POS / Caja Diaria) ============
CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  closing_date date,
  opening_amount numeric(14,2) NOT NULL DEFAULT 0,
  sales_cash numeric(14,2) NOT NULL DEFAULT 0,
  sales_transfer numeric(14,2) NOT NULL DEFAULT 0,
  sales_card numeric(14,2) NOT NULL DEFAULT 0,
  expenses_amount numeric(14,2) NOT NULL DEFAULT 0,
  expected_total numeric(14,2) NOT NULL DEFAULT 0,
  counted_total numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta','cerrada')),
  opened_by text NOT NULL DEFAULT 'Sistema',
  closed_by text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_cash_registers" ON cash_registers;
CREATE POLICY "anon_select_cash_registers" ON cash_registers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cash_registers" ON cash_registers;
CREATE POLICY "anon_insert_cash_registers" ON cash_registers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cash_registers" ON cash_registers;
CREATE POLICY "anon_update_cash_registers" ON cash_registers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cash_registers" ON cash_registers;
CREATE POLICY "anon_delete_cash_registers" ON cash_registers FOR DELETE TO anon, authenticated USING (true);

-- ============ CASH MOVEMENTS (ingresos/egresos within a cash turn) ============
CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('ingreso','egreso')),
  category text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_cash_movements" ON cash_movements;
CREATE POLICY "anon_select_cash_movements" ON cash_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cash_movements" ON cash_movements;
CREATE POLICY "anon_insert_cash_movements" ON cash_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cash_movements" ON cash_movements;
CREATE POLICY "anon_update_cash_movements" ON cash_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cash_movements" ON cash_movements;
CREATE POLICY "anon_delete_cash_movements" ON cash_movements FOR DELETE TO anon, authenticated USING (true);

-- ============ RECIPES (portion-based inventory deduction) ============
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  output_product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  output_quantity integer NOT NULL DEFAULT 1,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_recipes" ON recipes;
CREATE POLICY "anon_select_recipes" ON recipes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_recipes" ON recipes;
CREATE POLICY "anon_insert_recipes" ON recipes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_recipes" ON recipes;
CREATE POLICY "anon_update_recipes" ON recipes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_recipes" ON recipes;
CREATE POLICY "anon_delete_recipes" ON recipes FOR DELETE TO anon, authenticated USING (true);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_origin ON transfer_requests(origin_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_dest ON transfer_requests(dest_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_supply_requests_requestor ON supply_requests(requestor_company_id);
CREATE INDEX IF NOT EXISTS idx_supply_requests_supplier ON supply_requests(supplier_company_id);
CREATE INDEX IF NOT EXISTS idx_supply_requests_status ON supply_requests(status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_company ON cash_registers(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_recipes_company ON recipes(company_id);

-- ============ RPC: DISPATCH TRANSFER REQUEST (Step 1: Handshake) ============
-- Deducts from origin, marks as en_transito (global inventory unchanged in transit)
CREATE OR REPLACE FUNCTION dispatch_transfer_request(
  p_request_id uuid,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_origin_company_id uuid;
  v_inv_qty int;
BEGIN
  SELECT * INTO v_req FROM transfer_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_req.status NOT IN ('solicitada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;

  SELECT company_id INTO v_origin_company_id FROM warehouses WHERE id = v_req.origin_warehouse_id;

  SELECT quantity INTO v_inv_qty FROM inventory WHERE warehouse_id = v_req.origin_warehouse_id AND product_id = v_req.product_id;
  IF v_inv_qty IS NULL OR v_inv_qty < v_req.quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente en bodega de origen');
  END IF;

  -- Deduct from origin warehouse
  UPDATE inventory SET quantity = quantity - v_req.quantity, updated_at = now()
  WHERE warehouse_id = v_req.origin_warehouse_id AND product_id = v_req.product_id;

  -- Mark as en_transito
  UPDATE transfer_requests
    SET status = 'en_transito', dispatched_by = p_user_name, dispatch_date = CURRENT_DATE
  WHERE id = p_request_id;

  -- Record movement (transferencia salida, en tránsito)
  INSERT INTO movements (number, type, company_id, origin_warehouse_id, dest_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    get_next_doc_number('MOV', v_origin_company_id, 'movement'),
    'transferencia',
    v_origin_company_id,
    v_req.origin_warehouse_id,
    v_req.dest_warehouse_id,
    v_req.product_id,
    v_req.quantity,
    'transfer_request',
    p_request_id::text,
    p_user_name,
    'completada',
    'Despacho TR ' || v_req.number,
    CURRENT_DATE
  );

  RETURN jsonb_build_object('success', true, 'number', v_req.number);
END;
$$;

-- ============ RPC: RECEIVE TRANSFER REQUEST (Step 2: Handshake) ============
-- Adds to destination, marks as recibida
CREATE OR REPLACE FUNCTION receive_transfer_request(
  p_request_id uuid,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_dest_company_id uuid;
BEGIN
  SELECT * INTO v_req FROM transfer_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_req.status != 'en_transito' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud no está en tránsito');
  END IF;

  SELECT company_id INTO v_dest_company_id FROM warehouses WHERE id = v_req.dest_warehouse_id;

  -- Add to destination
  INSERT INTO inventory (warehouse_id, product_id, quantity)
  VALUES (v_req.dest_warehouse_id, v_req.product_id, v_req.quantity)
  ON CONFLICT (warehouse_id, product_id) DO UPDATE
    SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now();

  -- Mark as recibida
  UPDATE transfer_requests
    SET status = 'recibida', received_by = p_user_name, reception_date = CURRENT_DATE
  WHERE id = p_request_id;

  -- Record movement (entrada via transferencia recepcion)
  INSERT INTO movements (number, type, company_id, origin_warehouse_id, dest_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    get_next_doc_number('MOV', v_dest_company_id, 'movement'),
    'transferencia',
    v_dest_company_id,
    v_req.origin_warehouse_id,
    v_req.dest_warehouse_id,
    v_req.product_id,
    v_req.quantity,
    'transfer_request',
    p_request_id::text,
    p_user_name,
    'completada',
    'Recepción TR ' || v_req.number,
    CURRENT_DATE
  );

  RETURN jsonb_build_object('success', true, 'number', v_req.number);
END;
$$;

-- ============ RPC: REGISTER MERMA (shrinkage/waste) ============
CREATE OR REPLACE FUNCTION register_merma(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_reason text DEFAULT 'Merma',
  p_merma_date date DEFAULT CURRENT_DATE,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_inv_qty int;
BEGIN
  SELECT quantity INTO v_inv_qty FROM inventory WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;
  IF v_inv_qty IS NULL OR v_inv_qty < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente');
  END IF;

  UPDATE inventory SET quantity = quantity - p_quantity, updated_at = now()
  WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;

  v_number := get_next_doc_number('MER', p_company_id, 'merma');

  INSERT INTO movements (number, type, company_id, origin_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    v_number,
    'merma',
    p_company_id,
    p_warehouse_id,
    p_product_id,
    p_quantity,
    'merma',
    NULL,
    p_user_name,
    'completada',
    p_reason,
    p_merma_date
  );

  RETURN jsonb_build_object('success', true, 'number', v_number);
END;
$$;

-- ============ RPC: OPEN CASH REGISTER ============
CREATE OR REPLACE FUNCTION open_cash_register(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_opening_amount numeric DEFAULT 0,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_register_id uuid;
  v_open_register_count int;
BEGIN
  SELECT count(*) INTO v_open_register_count FROM cash_registers
  WHERE company_id = p_company_id AND status = 'abierta';
  IF v_open_register_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ya hay una caja abierta para esta empresa');
  END IF;

  v_number := get_next_doc_number('CAJ', p_company_id, 'cash_register');

  INSERT INTO cash_registers (number, company_id, warehouse_id, opening_date, opening_amount, status, opened_by)
  VALUES (v_number, p_company_id, p_warehouse_id, CURRENT_DATE, p_opening_amount, 'abierta', p_user_name)
  RETURNING id INTO v_register_id;

  RETURN jsonb_build_object('success', true, 'register_id', v_register_id, 'number', v_number);
END;
$$;

-- ============ RPC: CLOSE CASH REGISTER (Cuadre de Caja) ============
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

  -- Sum sales for this company/warehouse on this opening_date
  SELECT
    COALESCE(SUM(CASE WHEN payment_type = 'contado' THEN total ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_type = 'contado' THEN 0 ELSE 0 END), 0)
  INTO v_sales_cash
  FROM sales
  WHERE company_id = v_reg.company_id AND warehouse_id = v_reg.warehouse_id
    AND sale_date = v_reg.opening_date AND status = 'completada';

  -- Sum cash movements (egresos)
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses_amount
  FROM cash_movements
  WHERE cash_register_id = p_register_id AND type = 'egreso';

  v_expected_total := v_reg.opening_amount + v_sales_cash - v_expenses_amount;
  v_difference := p_counted_total - v_expected_total;

  UPDATE cash_registers
    SET status = 'cerrada',
        closing_date = CURRENT_DATE,
        sales_cash = v_sales_cash,
        sales_transfer = v_sales_transfer,
        sales_card = v_sales_card,
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

-- ============ RPC: APPLY RECIPE (consume ingredients, produce output) ============
CREATE OR REPLACE FUNCTION apply_recipe(
  p_recipe_id uuid,
  p_warehouse_id uuid,
  p_company_id uuid,
  p_batches int DEFAULT 1,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe RECORD;
  v_ingredient jsonb;
  v_ing_qty int;
  v_output_qty int;
  v_number text;
BEGIN
  SELECT * INTO v_recipe FROM recipes WHERE id = p_recipe_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Receta no encontrada o inactiva');
  END IF;

  -- Check all ingredients have enough stock (multiplied by batches)
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(v_recipe.ingredients) LOOP
    SELECT quantity INTO v_ing_qty FROM inventory
    WHERE warehouse_id = p_warehouse_id AND product_id = (v_ingredient->>'product_id')::uuid;
    IF v_ing_qty IS NULL OR v_ing_qty < ((v_ingredient->>'quantity')::int * p_batches) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente de ingrediente');
    END IF;
  END LOOP;

  -- Consume ingredients
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(v_recipe.ingredients) LOOP
    v_ing_qty := (v_ingredient->>'quantity')::int * p_batches;
    UPDATE inventory SET quantity = quantity - v_ing_qty, updated_at = now()
    WHERE warehouse_id = p_warehouse_id AND product_id = (v_ingredient->>'product_id')::uuid;

    -- Record salida movement
    INSERT INTO movements (number, type, company_id, origin_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
    VALUES (
      get_next_doc_number('MOV', p_company_id, 'movement'),
      'salida',
      p_company_id,
      p_warehouse_id,
      (v_ingredient->>'product_id')::uuid,
      v_ing_qty,
      'recipe',
      p_recipe_id::text,
      p_user_name,
      'completada',
      'Consumo receta: ' || v_recipe.name,
      CURRENT_DATE
    );
  END LOOP;

  -- Add output product
  v_output_qty := v_recipe.output_quantity * p_batches;
  INSERT INTO inventory (warehouse_id, product_id, quantity)
  VALUES (p_warehouse_id, v_recipe.output_product_id, v_output_qty)
  ON CONFLICT (warehouse_id, product_id) DO UPDATE
    SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now();

  -- Record entrada movement for output
  INSERT INTO movements (number, type, company_id, origin_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    get_next_doc_number('MOV', p_company_id, 'movement'),
    'entrada',
    p_company_id,
    p_warehouse_id,
    v_recipe.output_product_id,
    v_output_qty,
    'recipe',
    p_recipe_id::text,
    p_user_name,
    'completada',
    'Producción receta: ' || v_recipe.name,
    CURRENT_DATE
  );

  RETURN jsonb_build_object('success', true, 'output_qty', v_output_qty);
END;
$$;

-- Grant execute on all new functions
GRANT EXECUTE ON FUNCTION dispatch_transfer_request(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION receive_transfer_request(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_merma(uuid, uuid, uuid, int, text, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION open_cash_register(uuid, uuid, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION close_cash_register(uuid, numeric, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_recipe(uuid, uuid, uuid, int, text) TO anon, authenticated;
