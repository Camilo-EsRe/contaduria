/*
# Fix: get_next_doc_number with NULL company_id was creating duplicate sequences
# Fix: register_transfer should create movements visible to both origin and destination companies
*/

-- Fix get_next_doc_number: the ON CONFLICT clause needs to handle NULL company_id properly
CREATE OR REPLACE FUNCTION get_next_doc_number(
  p_prefix text,
  p_company_id uuid DEFAULT NULL,
  p_doc_type text DEFAULT 'general'
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq RECORD;
  v_next int;
BEGIN
  -- Insert sequence row if not exists
  INSERT INTO doc_sequences (company_id, doc_type, prefix, last_number)
  VALUES (p_company_id, p_doc_type, p_prefix, 0)
  ON CONFLICT (company_id, doc_type) DO NOTHING;

  -- Atomically increment and get the new value
  UPDATE doc_sequences
     SET last_number = last_number + 1
   WHERE company_id IS NOT DISTINCT FROM p_company_id
     AND doc_type = p_doc_type
   RETURNING last_number, prefix INTO v_seq;

  v_next := v_seq.last_number;
  RETURN v_seq.prefix || '-' || lpad(v_next::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_doc_number(text, uuid, text) TO anon, authenticated;

-- Fix register_transfer: create two movements (one for origin company, one for dest company)
-- so both companies see the transfer in their movement history
CREATE OR REPLACE FUNCTION register_transfer(
  p_origin_warehouse_id uuid,
  p_dest_warehouse_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_transfer_date date DEFAULT CURRENT_DATE,
  p_observations text DEFAULT NULL,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_origin_company_id uuid;
  v_dest_company_id uuid;
  v_inv_qty int;
BEGIN
  SELECT company_id INTO v_origin_company_id FROM warehouses WHERE id = p_origin_warehouse_id;
  SELECT company_id INTO v_dest_company_id FROM warehouses WHERE id = p_dest_warehouse_id;

  IF v_origin_company_id IS NULL OR v_dest_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bodega no encontrada');
  END IF;

  -- Check origin has enough stock
  SELECT quantity INTO v_inv_qty FROM inventory WHERE warehouse_id = p_origin_warehouse_id AND product_id = p_product_id;
  IF v_inv_qty IS NULL OR v_inv_qty < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente en bodega de origen');
  END IF;

  v_number := get_next_doc_number('TRF', NULL, 'transfer');

  -- Deduct from origin
  UPDATE inventory
    SET quantity = quantity - p_quantity, updated_at = now()
  WHERE warehouse_id = p_origin_warehouse_id AND product_id = p_product_id;

  -- Add to destination
  INSERT INTO inventory (warehouse_id, product_id, quantity)
  VALUES (p_dest_warehouse_id, p_product_id, p_quantity)
  ON CONFLICT (warehouse_id, product_id) DO UPDATE
    SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now();

  -- Movement at origin company (salida)
  INSERT INTO movements (number, type, company_id, origin_warehouse_id, dest_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    v_number,
    'transferencia',
    v_origin_company_id,
    p_origin_warehouse_id,
    p_dest_warehouse_id,
    p_product_id,
    p_quantity,
    'transfer',
    NULL,
    p_user_name,
    'completada',
    COALESCE(p_observations, '') || ' [Salida: ' || v_origin_company_id::text || ' → ' || v_dest_company_id::text || ']',
    p_transfer_date
  );

  -- Movement at dest company (entrada)
  INSERT INTO movements (number, type, company_id, origin_warehouse_id, dest_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    get_next_doc_number('MOV', v_dest_company_id, 'movement'),
    'transferencia',
    v_dest_company_id,
    p_origin_warehouse_id,
    p_dest_warehouse_id,
    p_product_id,
    p_quantity,
    'transfer',
    NULL,
    p_user_name,
    'completada',
    COALESCE(p_observations, '') || ' [Entrada: ' || v_origin_company_id::text || ' → ' || v_dest_company_id::text || ']',
    p_transfer_date
  );

  RETURN jsonb_build_object('success', true, 'number', v_number);
END;
$$;

GRANT EXECUTE ON FUNCTION register_transfer TO anon, authenticated;
