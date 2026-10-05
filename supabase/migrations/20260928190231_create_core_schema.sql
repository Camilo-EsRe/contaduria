/*
# Grupo JYC — Core Accounting & Inventory Schema

## Overview
Multi-company accounting and inventory control system for Grupo JYC.
JYC is the parent company with global visibility; operational companies
(JYC Papas, FINPOLLO) and 6 points of sale (Potines Andalucía, Bellavista,
49, La Planta, La Estrella, Mario Alitas) each have their own inventory,
movements, and financials.

## Tables Created
1. companies — all companies (parent + operational + points of sale)
2. warehouses — bodegas per company
3. products — product catalog (shared across group)
4. inventory — stock levels per product per warehouse
5. customers — customers per company
6. suppliers — suppliers per company
7. movements — inventory movements (entries, exits, transfers, purchases, sales)
8. purchases — purchase headers + items (embedded)
9. sales — sale headers + items (embedded)
10. invoices — accounts receivable invoices
11. payments — payments received (receivables)
12. payable_invoices — accounts payable invoices
13. supplier_payments — payments made to suppliers (payables)
14. expenses — gastos / egresos
15. incomes — ingresos
16. app_settings — low stock thresholds and other settings

## Security
- No auth: single-tenant shared app. All policies use `TO anon, authenticated`
  with `USING (true)` because the app is intentionally public/shared.
- RLS enabled on all tables.
*/

-- ============ COMPANIES ============
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('matriz','operativa','punto_venta')),
  parent_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============ WAREHOUSES ============
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unidad',
  category text,
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  sale_price numeric(14,2) NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ============ INVENTORY ============
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(warehouse_id, product_id)
);
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  identification text,
  phone text,
  address text,
  credit_limit numeric(14,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  identification text,
  phone text,
  address text,
  contact_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ============ MOVEMENTS ============
CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('entrada','salida','transferencia','compra','venta','devolucion','ajuste')),
  origin_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  dest_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_cost numeric(14,2) DEFAULT 0,
  reference_type text,
  reference_id text,
  user_name text NOT NULL DEFAULT 'Sistema',
  status text NOT NULL DEFAULT 'completada' CHECK (status IN ('pendiente','completada','anulada')),
  observations text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- ============ PURCHASES ============
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_type text NOT NULL DEFAULT 'contado' CHECK (payment_type IN ('contado','credito')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completada' CHECK (status IN ('pendiente','completada','anulada')),
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- ============ SALES ============
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_type text NOT NULL DEFAULT 'contado' CHECK (payment_type IN ('contado','credito')),
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completada' CHECK (status IN ('pendiente','completada','anulada')),
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- ============ RECEIVABLE INVOICES (Cartera) ============
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagada','vencida','anulada')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ============ RECEIVABLE PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  method text NOT NULL DEFAULT 'efectivo' CHECK (method IN ('efectivo','transferencia','tarjeta','cheque','otro')),
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============ PAYABLE INVOICES (Cuentas por Pagar) ============
CREATE TABLE IF NOT EXISTS payable_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  total numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagada','vencida','anulada')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payable_invoices ENABLE ROW LEVEL SECURITY;

-- ============ SUPPLIER PAYMENTS ============
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  payable_invoice_id uuid NOT NULL REFERENCES payable_invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  method text NOT NULL DEFAULT 'efectivo' CHECK (method IN ('efectivo','transferencia','tarjeta','cheque','otro')),
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- ============ EXPENSES (Gastos / Egresos) ============
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ============ INCOMES (Ingresos) ============
CREATE TABLE IF NOT EXISTS incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,
  user_name text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_company ON movements(company_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_payable_invoices_company ON payable_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_incomes_company ON incomes(company_id);

-- ============ RLS POLICIES (no-auth: anon + authenticated, shared data) ============
-- Helper to apply standard 4-policy CRUD to a table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','warehouses','products','inventory','customers','suppliers','movements','purchases','sales','invoices','payments','payable_invoices','supplier_payments','expenses','incomes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon, authenticated USING (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %I;', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true);', t, t);
  END LOOP;
END $$;

-- ============ SEQUENCES for document numbering ============
CREATE TABLE IF NOT EXISTS doc_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  prefix text NOT NULL DEFAULT '',
  UNIQUE(company_id, doc_type)
);
ALTER TABLE doc_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_doc_sequences" ON doc_sequences;
CREATE POLICY "anon_select_doc_sequences" ON doc_sequences FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_doc_sequences" ON doc_sequences;
CREATE POLICY "anon_insert_doc_sequences" ON doc_sequences FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_doc_sequences" ON doc_sequences;
CREATE POLICY "anon_update_doc_sequences" ON doc_sequences FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_doc_sequences" ON doc_sequences;
CREATE POLICY "anon_delete_doc_sequences" ON doc_sequences FOR DELETE TO anon, authenticated USING (true);