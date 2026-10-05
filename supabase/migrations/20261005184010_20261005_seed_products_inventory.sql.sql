/*
# Seed Products, Inventory, Customers, Suppliers for Grupo JYC

## What this does
1. Cleans up the 2 test products and re-seeds a proper product catalog
2. Seeds inventory for JYC Papas, FINPOLLO, and all 6 points of sale
3. Seeds customers for JYC Papas and FINPOLLO
4. Seeds suppliers for JYC Papas and FINPOLLO
5. Resets doc_sequences to start fresh

## Notes
- Idempotent: uses ON CONFLICT DO NOTHING for products
- Inventory uses ON CONFLICT DO UPDATE to avoid duplicates
- Companies and warehouses already exist from previous migration
*/

-- Clean up test products
DELETE FROM products WHERE sku IN ('KI', 'KAKA');

-- Reset doc sequences
DELETE FROM doc_sequences;

-- ============ PRODUCTS ============
INSERT INTO products (sku, name, unit, category, cost_price, sale_price, min_stock) VALUES
  ('PAP-9X9', 'Papas 9x9', 'paquete', 'Papas', 1200, 1800, 10),
  ('PAP-6X6', 'Papas 6x6', 'paquete', 'Papas', 900, 1400, 10),
  ('PAP-4X4', 'Papas 4x4', 'paquete', 'Papas', 700, 1100, 10),
  ('POL-ENTE', 'Pollo Entero', 'unidad', 'Pollo', 8500, 12000, 5),
  ('POL-PIER', 'Pollo Piernas', 'libra', 'Pollo', 6500, 9000, 8),
  ('POL-PECH', 'Pollo Pechuga', 'libra', 'Pollo', 7500, 10500, 8),
  ('ACE-1L', 'Aceite 1L', 'botella', 'Insumos', 4500, 6000, 5),
  ('BEB-COL', 'Bebida Cola 1.5L', 'unidad', 'Bebidas', 2200, 3500, 12),
  ('BEB-AGU', 'Agua 600ml', 'unidad', 'Bebidas', 800, 1500, 24),
  ('INS-SAL', 'Sal 1kg', 'paquete', 'Insumos', 900, 1500, 5),
  ('INS-HAR', 'Harina 1kg', 'paquete', 'Insumos', 1100, 1800, 8),
  ('ALI-ALIT', 'Alitas Pollo', 'libra', 'Pollo', 8000, 11500, 6)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  cost_price = EXCLUDED.cost_price,
  sale_price = EXCLUDED.sale_price,
  min_stock = EXCLUDED.min_stock;

-- ============ INVENTORY ============
-- FINPOLLO: main distributor, gets good stock of everything
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 50
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id = (SELECT id FROM companies WHERE code = 'FINP')
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- JYC Papas: good stock of papas and insumos
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 30
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id = (SELECT id FROM companies WHERE code = 'JYCP')
  AND p.sku IN ('PAP-9X9','PAP-6X6','PAP-4X4','INS-SAL','INS-HAR','ACE-1L','BEB-COL','BEB-AGU')
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- JYC (matriz): moderate stock
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 20
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id = (SELECT id FROM companies WHERE code = 'JYC')
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Points of sale: each gets small stock of key retail products
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 8
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id IN (SELECT id FROM companies WHERE type = 'punto_venta')
  AND p.sku IN ('PAP-9X9','PAP-6X6','BEB-COL','BEB-AGU','POL-PIER','ALI-ALIT')
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Mario Alitas gets extra chicken
INSERT INTO inventory (warehouse_id, product_id, quantity)
SELECT w.id, p.id, 15
FROM warehouses w
CROSS JOIN products p
WHERE w.company_id = (SELECT id FROM companies WHERE code = 'MAR-ALT')
  AND p.sku IN ('ALI-ALIT','POL-PIER','POL-PECH')
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.warehouse_id = w.id AND i.product_id = p.id)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- ============ CUSTOMERS ============
INSERT INTO customers (company_id, name, identification, phone, address, credit_limit)
SELECT c.id, v.name, v.identification, v.phone, v.address, v.credit_limit
FROM companies c
CROSS JOIN (VALUES
  ('Distribuidora El Sol', '80012345-6', '3001234567', 'Calle 45 #12-34', 500000),
  ('Supermercado La Economía', '90054321-3', '3109876543', 'Av. 30 #80-15', 300000)
) AS v(name, identification, phone, address, credit_limit)
WHERE c.code = 'JYCP'
  AND NOT EXISTS (SELECT 1 FROM customers cu WHERE cu.company_id = c.id AND cu.name = v.name);

INSERT INTO customers (company_id, name, identification, phone, address, credit_limit)
SELECT c.id, v.name, v.identification, v.phone, v.address, v.credit_limit
FROM companies c
CROSS JOIN (VALUES
  ('Restaurante Doña Rosa', '10293847-5', '3201112233', 'Carrera 12 #18-56', 200000),
  ('Pérez y Cía', '70123456-7', '3145566778', 'Calle 8 #90-12', 150000)
) AS v(name, identification, phone, address, credit_limit)
WHERE c.code = 'FINP'
  AND NOT EXISTS (SELECT 1 FROM customers cu WHERE cu.company_id = c.id AND cu.name = v.name);

-- ============ SUPPLIERS ============
INSERT INTO suppliers (company_id, name, identification, phone, address, contact_name)
SELECT c.id, v.name, v.identification, v.phone, v.address, v.contact_name
FROM companies c
CROSS JOIN (VALUES
  ('Industrial de Papas S.A.', '90123456-7', '6015551234', 'Zona Industrial Lote 12', 'Carlos Muñoz'),
  ('Distribuidora La Norteña', '70123456-1', '6013339876', 'Calle 100 #50-20', 'Luis Gómez')
) AS v(name, identification, phone, address, contact_name)
WHERE c.code = 'JYCP'
  AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.company_id = c.id AND s.name = v.name);

INSERT INTO suppliers (company_id, name, identification, phone, address, contact_name)
SELECT c.id, v.name, v.identification, v.phone, v.address, v.contact_name
FROM companies c
CROSS JOIN (VALUES
  ('Avícola del Valle', '80098765-4', '6024445678', 'Km 5 Vía Cali', 'Ana López'),
  ('Distribuidora La Norteña', '70123456-1', '6013339876', 'Calle 100 #50-20', 'Luis Gómez')
) AS v(name, identification, phone, address, contact_name)
WHERE c.code = 'FINP'
  AND NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.company_id = c.id AND s.name = v.name);
