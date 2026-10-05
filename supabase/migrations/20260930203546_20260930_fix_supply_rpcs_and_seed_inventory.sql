/*
# Fix: Supply request dispatch/receive should move inventory
# Fix: Transfer requests need proper company_id for doc numbering
# Fix: Old register_transfer should create movements visible to both companies
*/

-- ============ RPC: DISPATCH SUPPLY REQUEST (moves inventory from supplier to requestor) ============
CREATE OR REPLACE FUNCTION dispatch_supply_request(
  p_request_id uuid,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_item jsonb;
  v_supplier_wh uuid;
  v_requestor_wh uuid;
  v_supplier_company_id uuid;
  v_requestor_company_id uuid;
  v_inv_qty int;
BEGIN
  SELECT * INTO v_req FROM supply_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_req.status != 'aprobada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud debe estar aprobada primero');
  END IF;

  -- Get warehouses
  SELECT id INTO v_supplier_wh FROM warehouses WHERE company_id = v_req.supplier_company_id LIMIT 1;
  SELECT id INTO v_requestor_wh FROM warehouses WHERE company_id = v_req.requestor_company_id LIMIT 1;
  v_supplier_company_id := v_req.supplier_company_id;
  v_requestor_company_id := v_req.requestor_company_id;

  IF v_supplier_wh IS NULL OR v_requestor_wh IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bodega no encontrada');
  END IF;

  -- Check and deduct inventory from supplier for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_req.items) LOOP
    SELECT quantity INTO v_inv_qty FROM inventory
    WHERE warehouse_id = v_supplier_wh AND product_id = (v_item->>'product_id')::uuid;
    IF v_inv_qty IS NULL OR v_inv_qty < (v_item->>'quantity')::int THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente: ' || (v_item->>'product_name'));
    END IF;
    UPDATE inventory SET quantity = quantity - (v_item->>'quantity')::int, updated_at = now()
    WHERE warehouse_id = v_supplier_wh AND product_id = (v_item->>'product_id')::uuid;
  END LOOP;

  -- Add inventory to requestor
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_req.items) LOOP
    INSERT INTO inventory (warehouse_id, product_id, quantity)
    VALUES (v_requestor_wh, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int)
    ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now();

    -- Movement at supplier (salida)
    INSERT INTO movements (number, type, company_id, origin_warehouse_id, dest_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
    VALUES (
      get_next_doc_number('MOV', v_supplier_company_id, 'movement'),
      'transferencia',
      v_supplier_company_id,
      v_supplier_wh,
      v_requestor_wh,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      'supply_request',
      p_request_id::text,
      p_user_name,
      'completada',
      'Despacho SOL ' || v_req.number,
      CURRENT_DATE
    );
  END LOOP;

  UPDATE supply_requests SET status = 'despachada', dispatch_date = CURRENT_DATE, reviewed_by = p_user_name
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'number', v_req.number);
END;
$$;

-- ============ RPC: RECEIVE SUPPLY REQUEST (confirm arrival) ============
CREATE OR REPLACE FUNCTION receive_supply_request(
  p_request_id uuid,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_item jsonb;
  v_requestor_wh uuid;
  v_requestor_company_id uuid;
BEGIN
  SELECT * INTO v_req FROM supply_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_req.status != 'despachada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud debe estar despachada primero');
  END IF;

  SELECT id INTO v_requestor_wh FROM warehouses WHERE company_id = v_req.requestor_company_id LIMIT 1;
  v_requestor_company_id := v_req.requestor_company_id;

  -- Record entrada movements at requestor
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_req.items) LOOP
    INSERT INTO movements (number, type, company_id, origin_warehouse_id, dest_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
    VALUES (
      get_next_doc_number('MOV', v_requestor_company_id, 'movement'),
      'transferencia',
      v_requestor_company_id,
      NULL,
      v_requestor_wh,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      'supply_request',
      p_request_id::text,
      p_user_name,
      'completada',
      'Recepción SOL ' || v_req.number,
      CURRENT_DATE
    );
  END LOOP;

  UPDATE supply_requests SET status = 'recibida', reception_date = CURRENT_DATE
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'number', v_req.number);
END;
$$;

-- ============ RPC: APPROVE SUPPLY REQUEST ============
CREATE OR REPLACE FUNCTION approve_supply_request(
  p_request_id uuid,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM supply_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_req.status != 'solicitada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;
  UPDATE supply_requests SET status = 'aprobada', approved_date = CURRENT_DATE, reviewed_by = p_user_name
  WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true, 'number', v_req.number);
END;
$$;

-- ============ RPC: REJECT SUPPLY REQUEST ============
CREATE OR REPLACE FUNCTION reject_supply_request(
  p_request_id uuid,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM supply_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
  END IF;
  IF v_req.status != 'solicitada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La solicitud ya fue procesada');
  END IF;
  UPDATE supply_requests SET status = 'rechazada', reviewed_by = p_user_name
  WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true, 'number', v_req.number);
END;
$$;

GRANT EXECUTE ON FUNCTION dispatch_supply_request(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION receive_supply_request(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approve_supply_request(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_supply_request(uuid, text) TO anon, authenticated;

-- ============ Seed inventory for all POS warehouses ============
-- Give each POS some starting inventory of key products
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 5
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id IN (
  SELECT id FROM companies WHERE type = 'punto_venta'
)
AND NOT EXISTS (
  SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id
)
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

-- Give JYC (matriz) warehouse some inventory too
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 10
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id = '44715139-0880-41dd-aeef-e2cc609e1d99'
AND NOT EXISTS (
  SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id
)
ON CONFLICT (warehouse_id, product_id) DO NOTHING;
