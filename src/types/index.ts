export interface Company {
  id: string;
  code: string;
  name: string;
  type: 'matriz' | 'operativa' | 'punto_venta';
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string | null;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
}

export interface Inventory {
  id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
  warehouse?: Warehouse;
  company?: Company;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  identification: string | null;
  phone: string | null;
  address: string | null;
  contact_name: string | null;
  created_at: string;
}

export interface Movement {
  id: string;
  number: string;
  type: 'entrada' | 'salida' | 'transferencia' | 'compra' | 'venta' | 'devolucion' | 'ajuste' | 'merma';
  origin_warehouse_id: string | null;
  dest_warehouse_id: string | null;
  company_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  user_name: string;
  status: 'pendiente' | 'completada' | 'anulada';
  observations: string | null;
  movement_date: string;
  created_at: string;
  product?: Product;
  company?: Company;
  origin_warehouse?: Warehouse;
  dest_warehouse?: Warehouse;
}

export interface TransferRequest {
  id: string;
  number: string;
  origin_warehouse_id: string;
  dest_warehouse_id: string;
  product_id: string;
  quantity: number;
  status: 'solicitada' | 'despachada' | 'en_transito' | 'recibida' | 'anulada';
  requested_by: string;
  dispatched_by: string | null;
  received_by: string | null;
  dispatch_date: string | null;
  reception_date: string | null;
  observations: string | null;
  created_at: string;
  product?: Product;
  origin_warehouse?: Warehouse;
  dest_warehouse?: Warehouse;
}

export interface SupplyRequestItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export interface SupplyRequest {
  id: string;
  number: string;
  requestor_company_id: string;
  requestor_warehouse_id: string;
  supplier_company_id: string;
  items: SupplyRequestItem[];
  status: 'solicitada' | 'aprobada' | 'despachada' | 'recibida' | 'rechazada';
  requested_by: string;
  reviewed_by: string | null;
  notes: string | null;
  request_date: string;
  approved_date: string | null;
  dispatch_date: string | null;
  reception_date: string | null;
  created_at: string;
  requestor_company?: Company;
  supplier_company?: Company;
  requestor_warehouse?: Warehouse;
}

export interface CashRegister {
  id: string;
  number: string;
  company_id: string;
  warehouse_id: string;
  opening_date: string;
  closing_date: string | null;
  opening_amount: number;
  sales_cash: number;
  sales_transfer: number;
  sales_card: number;
  expenses_amount: number;
  expected_total: number;
  counted_total: number;
  difference: number;
  status: 'abierta' | 'cerrada';
  opened_by: string;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface CashMovement {
  id: string;
  number: string;
  cash_register_id: string;
  company_id: string;
  type: 'ingreso' | 'egreso';
  category: string;
  description: string | null;
  amount: number;
  movement_date: string;
  user_name: string;
  created_at: string;
}

export interface RecipeIngredient {
  product_id: string;
  product_name: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  company_id: string;
  name: string;
  output_product_id: string;
  output_quantity: number;
  ingredients: RecipeIngredient[];
  is_active: boolean;
  created_at: string;
  output_product?: Product;
}

export interface PurchaseItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

export interface Purchase {
  id: string;
  number: string;
  company_id: string;
  warehouse_id: string;
  supplier_id: string | null;
  purchase_date: string;
  payment_type: 'contado' | 'credito';
  subtotal: number;
  tax: number;
  total: number;
  status: 'pendiente' | 'completada' | 'anulada';
  notes: string | null;
  items: PurchaseItem[];
  user_name: string;
  created_at: string;
  company?: Company;
  warehouse?: Warehouse;
  supplier?: Supplier;
}

export interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface Sale {
  id: string;
  number: string;
  company_id: string;
  warehouse_id: string;
  customer_id: string | null;
  sale_date: string;
  payment_type: 'contado' | 'credito';
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  status: 'pendiente' | 'completada' | 'anulada';
  notes: string | null;
  items: SaleItem[];
  user_name: string;
  created_at: string;
  company?: Company;
  warehouse?: Warehouse;
  customer?: Customer;
}

export interface Invoice {
  id: string;
  number: string;
  company_id: string;
  customer_id: string;
  sale_id: string | null;
  invoice_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  balance: number;
  status: 'pendiente' | 'pagada' | 'vencida' | 'anulada';
  created_at: string;
  company?: Company;
  customer?: Customer;
}

export interface Payment {
  id: string;
  number: string;
  invoice_id: string;
  company_id: string;
  customer_id: string;
  payment_date: string;
  amount: number;
  method: string;
  user_name: string;
  created_at: string;
}

export interface PayableInvoice {
  id: string;
  number: string;
  company_id: string;
  supplier_id: string;
  purchase_id: string | null;
  invoice_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  balance: number;
  status: 'pendiente' | 'pagada' | 'vencida' | 'anulada';
  created_at: string;
  company?: Company;
  supplier?: Supplier;
}

export interface SupplierPayment {
  id: string;
  number: string;
  payable_invoice_id: string;
  company_id: string;
  supplier_id: string;
  payment_date: string;
  amount: number;
  method: string;
  user_name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  number: string;
  company_id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  user_name: string;
  created_at: string;
  company?: Company;
}

export interface Income {
  id: string;
  number: string;
  company_id: string;
  income_date: string;
  category: string;
  description: string | null;
  amount: number;
  user_name: string;
  created_at: string;
  company?: Company;
}
