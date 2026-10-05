/*
# Grupo JYC — RPC Functions for Transactional Operations

## Functions Created
1. get_next_doc_number(prefix, company_id, doc_type) — generates sequential document numbers
2. register_purchase(p_data) — creates a purchase, adds inventory entries, creates payable invoice if credit
3. register_sale(s_data) — creates a sale, deducts inventory, creates receivable invoice if credit
4. register_transfer(t_data) — moves stock between warehouses (origin out, dest in)
5. register_inventory_adjustment(a_data) — manual entrada/salida
6. register_customer_payment(p_data) — records a payment against a receivable invoice
7. register_supplier_payment(p_data) — records a payment against a payable invoice

All functions are SECURITY DEFINER so they can update inventory, movements, and invoices
atomically. The anon role has CRUD policies on all tables, but these functions ensure
transactional consistency (inventory + movements + financials stay in sync).
*/

-- ============ NEXT DOC NUMBER ============
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
  INSERT INTO doc_sequences (company_id, doc_type, prefix, last_number)
  VALUES (p_company_id, p_doc_type, p_prefix, 0)
  ON CONFLICT (company_id, doc_type) DO NOTHING;

  UPDATE doc_sequences
     SET last_number = last_number + 1
   WHERE company_id IS NOT DISTINCT FROM p_company_id
     AND doc_type = p_doc_type
   RETURNING last_number, prefix INTO v_seq;

  v_next := v_seq.last_number;
  RETURN v_seq.prefix || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- ============ REGISTER PURCHASE ============
CREATE OR REPLACE FUNCTION register_purchase(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_supplier_id uuid DEFAULT NULL,
  p_purchase_date date DEFAULT CURRENT_DATE,
  p_payment_type text DEFAULT 'contado',
  p_items jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_purchase_id uuid;
  v_item jsonb;
  v_subtotal numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_line_total numeric(14,2);
  v_inv record;
  v_payable_number text;
  v_payable_id uuid;
BEGIN
  v_number := get_next_doc_number('CMP', p_company_id, 'purchase');

  -- Calculate totals from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_total := (v_item->>'quantity')::numeric * (v_item->>'unit_cost')::numeric;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;
  v_total := v_subtotal + v_tax;

  -- Create purchase record
  INSERT INTO purchases (number, company_id, warehouse_id, supplier_id, purchase_date, payment_type, subtotal, tax, total, status, notes, items, user_name)
  VALUES (v_number, p_company_id, p_warehouse_id, p_supplier_id, p_purchase_date, p_payment_type, v_subtotal, v_tax, v_total, 'completada', p_notes, p_items, p_user_name)
  RETURNING id INTO v_purchase_id;

  -- Process each item: add inventory + create movement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Upsert inventory
    INSERT INTO inventory (warehouse_id, product_id, quantity)
    VALUES (p_warehouse_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int)
    ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET quantity = inventory.quantity + EXCLUDED.quantity,
          updated_at = now();

    -- Create movement (entrada via compra)
    INSERT INTO movements (number, type, company_id, origin_warehouse_id, product_id, quantity, unit_cost, reference_type, reference_id, user_name, status, observations, movement_date)
    VALUES (
      get_next_doc_number('MOV', p_company_id, 'movement'),
      'compra',
      p_company_id,
      p_warehouse_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_cost')::numeric,
      'purchase',
      v_purchase_id::text,
      p_user_name,
      'completada',
      'Compra ' || v_number,
      p_purchase_date
    );
  END LOOP;

  -- If credit purchase, create payable invoice
  IF p_payment_type = 'credito' AND p_supplier_id IS NOT NULL THEN
    v_payable_number := get_next_doc_number('CXP', p_company_id, 'payable');
    INSERT INTO payable_invoices (number, company_id, supplier_id, purchase_id, invoice_date, due_date, total, paid_amount, balance, status)
    VALUES (v_payable_number, p_company_id, p_supplier_id, v_purchase_id, p_purchase_date, p_purchase_date + interval '30 days', v_total, 0, v_total, 'pendiente')
    RETURNING id INTO v_payable_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'number', v_number,
    'total', v_total,
    'payable_invoice_id', v_payable_id
  );
END;
$$;

-- ============ REGISTER SALE ============
CREATE OR REPLACE FUNCTION register_sale(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_sale_date date DEFAULT CURRENT_DATE,
  p_payment_type text DEFAULT 'contado',
  p_items jsonb DEFAULT '[]'::jsonb,
  p_paid_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_sale_id uuid;
  v_item jsonb;
  v_subtotal numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_line_total numeric(14,2);
  v_inv_qty int;
  v_invoice_number text;
  v_invoice_id uuid;
  v_paid numeric(14,2);
BEGIN
  v_number := get_next_doc_number('VTA', p_company_id, 'sale');

  -- Calculate totals
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;
  v_total := v_subtotal + v_tax;

  -- Check inventory availability for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT quantity INTO v_inv_qty FROM inventory WHERE warehouse_id = p_warehouse_id AND product_id = (v_item->>'product_id')::uuid;
    IF v_inv_qty IS NULL OR v_inv_qty < (v_item->>'quantity')::int THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente para producto ' || (v_item->>'product_name'));
    END IF;
  END LOOP;

  v_paid := CASE WHEN p_paid_amount > 0 THEN p_paid_amount ELSE CASE WHEN p_payment_type = 'contado' THEN v_total ELSE 0 END END;

  -- Create sale record
  INSERT INTO sales (number, company_id, warehouse_id, customer_id, sale_date, payment_type, subtotal, tax, total, paid_amount, status, notes, items, user_name)
  VALUES (v_number, p_company_id, p_warehouse_id, p_customer_id, p_sale_date, p_payment_type, v_subtotal, v_tax, v_total, v_paid, 'completada', p_notes, p_items, p_user_name)
  RETURNING id INTO v_sale_id;

  -- Process each item: deduct inventory + create movement
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Deduct inventory
    UPDATE inventory
      SET quantity = quantity - (v_item->>'quantity')::int,
          updated_at = now()
    WHERE warehouse_id = p_warehouse_id AND product_id = (v_item->>'product_id')::uuid;

    -- Create movement (salida via venta)
    INSERT INTO movements (number, type, company_id, origin_warehouse_id, product_id, quantity, unit_cost, reference_type, reference_id, user_name, status, observations, movement_date)
    VALUES (
      get_next_doc_number('MOV', p_company_id, 'movement'),
      'venta',
      p_company_id,
      p_warehouse_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      'sale',
      v_sale_id::text,
      p_user_name,
      'completada',
      'Venta ' || v_number,
      p_sale_date
    );
  END LOOP;

  -- If credit sale and customer exists, create receivable invoice
  IF p_payment_type = 'credito' AND p_customer_id IS NOT NULL THEN
    v_invoice_number := get_next_doc_number('CXC', p_company_id, 'receivable');
    INSERT INTO invoices (number, company_id, customer_id, sale_id, invoice_date, due_date, total, paid_amount, balance, status)
    VALUES (v_invoice_number, p_company_id, p_customer_id, v_sale_id, p_sale_date, p_sale_date + interval '30 days', v_total, v_paid, v_total - v_paid, 'pendiente')
    RETURNING id INTO v_invoice_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'number', v_number,
    'total', v_total,
    'invoice_id', v_invoice_id
  );
END;
$$;

-- ============ REGISTER TRANSFER ============
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
  -- Get company IDs from warehouses
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

  -- Create single transfer movement record
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
    COALESCE(p_observations, '') || ' [Origen: ' || v_origin_company_id::text || ' → Destino: ' || v_dest_company_id::text || ']',
    p_transfer_date
  );

  RETURN jsonb_build_object('success', true, 'number', v_number);
END;
$$;

-- ============ REGISTER INVENTORY ADJUSTMENT ============
CREATE OR REPLACE FUNCTION register_inventory_adjustment(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity int,
  p_type text,
  p_adj_date date DEFAULT CURRENT_DATE,
  p_observations text DEFAULT NULL,
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
  IF p_type = 'salida' THEN
    SELECT quantity INTO v_inv_qty FROM inventory WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;
    IF v_inv_qty IS NULL OR v_inv_qty < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente');
    END IF;
    UPDATE inventory SET quantity = quantity - p_quantity, updated_at = now()
    WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id;
  ELSE
    INSERT INTO inventory (warehouse_id, product_id, quantity)
    VALUES (p_warehouse_id, p_product_id, p_quantity)
    ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now();
  END IF;

  v_number := get_next_doc_number('MOV', p_company_id, 'movement');

  INSERT INTO movements (number, type, company_id, origin_warehouse_id, product_id, quantity, reference_type, reference_id, user_name, status, observations, movement_date)
  VALUES (
    v_number,
    p_type,
    p_company_id,
    p_warehouse_id,
    p_product_id,
    p_quantity,
    'adjustment',
    NULL,
    p_user_name,
    'completada',
    COALESCE(p_observations, 'Ajuste de inventario'),
    p_adj_date
  );

  RETURN jsonb_build_object('success', true, 'number', v_number);
END;
$$;

-- ============ REGISTER CUSTOMER PAYMENT ============
CREATE OR REPLACE FUNCTION register_customer_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_method text DEFAULT 'efectivo',
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_number text;
  v_new_paid numeric(14,2);
  v_new_balance numeric(14,2);
  v_new_status text;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Factura no encontrada');
  END IF;

  v_new_paid := v_invoice.paid_amount + p_amount;
  v_new_balance := v_invoice.total - v_new_paid;
  v_new_status := CASE WHEN v_new_balance <= 0 THEN 'pagada' ELSE 'pendiente' END;

  v_number := get_next_doc_number('PAG', v_invoice.company_id, 'payment');

  INSERT INTO payments (number, invoice_id, company_id, customer_id, payment_date, amount, method, user_name)
  VALUES (v_number, p_invoice_id, v_invoice.company_id, v_invoice.customer_id, p_payment_date, p_amount, p_method, p_user_name);

  UPDATE invoices SET paid_amount = v_new_paid, balance = v_new_balance, status = v_new_status WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true, 'number', v_number, 'new_balance', v_new_balance, 'status', v_new_status);
END;
$$;

-- ============ REGISTER SUPPLIER PAYMENT ============
CREATE OR REPLACE FUNCTION register_supplier_payment(
  p_payable_invoice_id uuid,
  p_amount numeric,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_method text DEFAULT 'efectivo',
  p_user_name text DEFAULT 'Sistema'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_number text;
  v_new_paid numeric(14,2);
  v_new_balance numeric(14,2);
  v_new_status text;
BEGIN
  SELECT * INTO v_invoice FROM payable_invoices WHERE id = p_payable_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Factura no encontrada');
  END IF;

  v_new_paid := v_invoice.paid_amount + p_amount;
  v_new_balance := v_invoice.total - v_new_paid;
  v_new_status := CASE WHEN v_new_balance <= 0 THEN 'pagada' ELSE 'pendiente' END;

  v_number := get_next_doc_number('PAP', v_invoice.company_id, 'supplier_payment');

  INSERT INTO supplier_payments (number, payable_invoice_id, company_id, supplier_id, payment_date, amount, method, user_name)
  VALUES (v_number, p_payable_invoice_id, v_invoice.company_id, v_invoice.supplier_id, p_payment_date, p_amount, p_method, p_user_name);

  UPDATE payable_invoices SET paid_amount = v_new_paid, balance = v_new_balance, status = v_new_status WHERE id = p_payable_invoice_id;

  RETURN jsonb_build_object('success', true, 'number', v_number, 'new_balance', v_new_balance, 'status', v_new_status);
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION get_next_doc_number(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_purchase TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_sale TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_transfer TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_inventory_adjustment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_customer_payment TO anon, authenticated;
GRANT EXECUTE ON FUNCTION register_supplier_payment TO anon, authenticated;