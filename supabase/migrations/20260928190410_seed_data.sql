/*
# Grupo JYC — Seed Data

## Companies
1. JYC (matriz/parent)
2. JYC Papas (operativa)
3. FINPOLLO (operativa)
4-9. 6 Potines points of sale + Mario Alitas

## Warehouses
One main warehouse per company.

## Products
Sample products for the group: papas, pollo, aceites, bebidas, insumos.
*/
DO $$
DECLARE
  v_jyc uuid;
  v_jyc_papas uuid;
  v_finpollo uuid;
  v_wh uuid;
BEGIN
  -- Parent company
  INSERT INTO companies (code, name, type, parent_id)
  VALUES ('JYC', 'JYC', 'matriz', NULL)
  RETURNING id INTO v_jyc;

  -- Operational companies
  INSERT INTO companies (code, name, type, parent_id)
  VALUES ('JYCP', 'JYC Papas', 'operativa', v_jyc)
  RETURNING id INTO v_jyc_papas;

  INSERT INTO companies (code, name, type, parent_id)
  VALUES ('FINP', 'FINPOLLO', 'operativa', v_jyc)
  RETURNING id INTO v_finpollo;

  -- Points of sale
  INSERT INTO companies (code, name, type, parent_id) VALUES
    ('PT-AND', 'Potines Andalucía', 'punto_venta', v_jyc),
    ('PT-BEL', 'Potines Bellavista', 'punto_venta', v_jyc),
    ('PT-049', 'Potines 49', 'punto_venta', v_jyc),
    ('PT-PLA', 'Potines La Planta', 'punto_venta', v_jyc),
    ('PT-EST', 'Potines La Estrella', 'punto_venta', v_jyc),
    ('MAR-ALT', 'Mario Alitas', 'punto_venta', v_jyc);

  -- Warehouses for each company
  INSERT INTO warehouses (company_id, name)
  SELECT id, 'Bodega Principal' FROM companies;

  -- Sample products
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
    ('ALI-ALIT', 'Alitas Pollo', 'libra', 'Pollo', 8000, 11500, 6);

  -- Seed initial inventory for FINPOLLO and JYC Papas
  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_finpollo LIMIT 1;
  INSERT INTO inventory (warehouse_id, product_id, quantity)
  SELECT v_wh, p.id, 20 FROM products p WHERE p.sku IN ('PAP-9X9','PAP-6X6','POL-ENTE','POL-PIER','ACE-1L','BEB-COL');

  SELECT id INTO v_wh FROM warehouses WHERE company_id = v_jyc_papas LIMIT 1;
  INSERT INTO inventory (warehouse_id, product_id, quantity)
  SELECT v_wh, p.id, 10 FROM products p WHERE p.sku IN ('PAP-9X9','PAP-6X6','PAP-4X4','INS-SAL','INS-HAR');

  -- Seed a few stock items for some points of sale
  INSERT INTO inventory (warehouse_id, product_id, quantity)
  SELECT w.id, p.id, 5
  FROM warehouses w
  CROSS JOIN products p
  WHERE w.company_id IN (SELECT id FROM companies WHERE code = 'PT-049')
    AND p.sku IN ('PAP-9X9','BEB-COL','POL-PIER');

  INSERT INTO inventory (warehouse_id, product_id, quantity)
  SELECT w.id, p.id, 2
  FROM warehouses w
  CROSS JOIN products p
  WHERE w.company_id IN (SELECT id FROM companies WHERE code = 'PT-PLA')
    AND p.sku IN ('PAP-9X9','BEB-COL');

  -- Sample customers
  INSERT INTO customers (company_id, name, identification, phone, address, credit_limit) VALUES
    (v_jyc_papas, 'Distribuidora El Sol', '80012345-6', '3001234567', 'Calle 45 #12-34', 500000),
    (v_jyc_papas, 'Supermercado La Economía', '90054321-3', '3109876543', 'Av. 30 #80-15', 300000),
    (v_finpollo, 'Restaurante Doña Rosa', '10293847-5', '3201112233', 'Carrera 12 #18-56', 200000),
    (v_finpollo, 'Pérez y Cía', '70123456-7', '3145566778', 'Calle 8 #90-12', 150000);

  -- Sample suppliers
  INSERT INTO suppliers (company_id, name, identification, phone, address, contact_name) VALUES
    (v_jyc_papas, 'Industrial de Papas S.A.', '90123456-7', '6015551234', 'Zona Industrial Lote 12', 'Carlos Muñoz'),
    (v_finpollo, 'Avícola del Valle', '80098765-4', '6024445678', 'Km 5 Vía Cali', 'Ana López'),
    (v_finpollo, 'Distribuidora La Norteña', '70123456-1', '6013339876', 'Calle 100 #50-20', 'Luis Gómez');
END $$;