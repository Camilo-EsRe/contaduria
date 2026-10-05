/*
# Seed 9 Companies for Grupo JYC

## What this does
Re-inserts the 9 companies that make up the Grupo JYC structure after the
previous full-wipe migration emptied the database.

## Companies
1. JYC (matriz / parent)
2. JYC Papas (operativa, child of JYC)
3. FINPOLLO (operativa, child of JYC)
4. Potines Andalucía (punto_venta, child of JYC)
5. Potines Bellavista (punto_venta, child of JYC)
6. Potines 49 (punto_venta, child of JYC)
7. Potines La Planta (punto_venta, child of JYC)
8. Potines La Estrella (punto_venta, child of JYC)
9. Mario Alitas (punto_venta, child of JYC)

## Warehouses
Each company gets one "Bodega Principal" warehouse so inventory and
operations work immediately.

## Notes
- Uses DO $$ block so we can capture the parent UUID and reference it.
- Idempotent: checks for existing companies by code before inserting.
- No RLS changes needed — companies table already has policies.
*/

DO $$
DECLARE
  v_jyc uuid;
BEGIN
  -- Get or create the parent company (JYC)
  SELECT id INTO v_jyc FROM companies WHERE code = 'JYC' LIMIT 1;
  IF v_jyc IS NULL THEN
    INSERT INTO companies (code, name, type, parent_id)
    VALUES ('JYC', 'JYC', 'matriz', NULL)
    RETURNING id INTO v_jyc;
  END IF;

  -- Insert operational companies if they don't exist
  INSERT INTO companies (code, name, type, parent_id)
  SELECT 'JYCP', 'JYC Papas', 'operativa', v_jyc
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE code = 'JYCP');

  INSERT INTO companies (code, name, type, parent_id)
  SELECT 'FINP', 'FINPOLLO', 'operativa', v_jyc
  WHERE NOT EXISTS (SELECT 1 FROM companies WHERE code = 'FINP');

  -- Insert points of sale if they don't exist
  INSERT INTO companies (code, name, type, parent_id)
  SELECT t.code, t.name, t.type, v_jyc
  FROM (VALUES
    ('PT-AND', 'Potines Andalucía', 'punto_venta'),
    ('PT-BEL', 'Potines Bellavista', 'punto_venta'),
    ('PT-049', 'Potines 49', 'punto_venta'),
    ('PT-PLA', 'Potines La Planta', 'punto_venta'),
    ('PT-EST', 'Potines La Estrella', 'punto_venta'),
    ('MAR-ALT', 'Mario Alitas', 'punto_venta')
  ) AS t(code, name, type)
  WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.code = t.code);

  -- Update parent_id for companies that might have been inserted without it
  UPDATE companies SET parent_id = v_jyc
  WHERE parent_id IS NULL
    AND code IN ('JYCP','FINP','PT-AND','PT-BEL','PT-049','PT-PLA','PT-EST','MAR-ALT');

  -- Create a main warehouse for any company that doesn't have one
  INSERT INTO warehouses (company_id, name)
  SELECT c.id, 'Bodega Principal'
  FROM companies c
  WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.company_id = c.id);
END $$;
