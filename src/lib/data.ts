import { supabase } from './supabase';
import type {
  Company,
  Warehouse,
  Product,
  Inventory,
  Customer,
  Supplier,
  Movement,
  Purchase,
  Sale,
  Invoice,
  Payment,
  PayableInvoice,
  SupplierPayment,
  Expense,
  Income,
  PurchaseItem,
  SaleItem,
  TransferRequest,
  SupplyRequest,
  SupplyRequestItem,
  CashRegister,
  CashMovement,
  Recipe,
  RecipeIngredient,
} from '@/types';

// ---- Companies ----
export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Company[];
}

// ---- Warehouses ----
export async function fetchWarehouses(companyId?: string): Promise<Warehouse[]> {
  let q = supabase.from('warehouses').select('*').order('name');
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as Warehouse[];
}

export async function fetchAllWarehousesWithCompany(): Promise<(Warehouse & { company: Company })[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*, company:companies(*)')
    .order('name');
  if (error) throw error;
  return data as any;
}

// ---- Products ----
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(p: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(p).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, p: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase.from('products').update(p).eq('id', id).select().single();
  if (error) throw error;
  return data as Product;
}

// ---- Inventory ----
export async function fetchInventoryByWarehouse(warehouseId: string): Promise<Inventory[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, product:products(*)')
    .eq('warehouse_id', warehouseId)
    .order('created_at');
  if (error) throw error;
  return data as any;
}

export async function fetchInventoryByCompany(companyId: string): Promise<(Inventory & { warehouse: Warehouse; product: Product })[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, warehouse:warehouses(*, company:companies(*)), product:products(*)')
    .order('created_at');
  if (error) throw error;
  const all = (data || []) as any[];
  return all.filter((r) => r.warehouse?.company_id === companyId) as any;
}

export async function fetchConsolidatedInventory(): Promise<(Inventory & { warehouse: Warehouse; product: Product })[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, warehouse:warehouses(*), product:products(*)')
    .order('created_at');
  if (error) throw error;
  return data as any;
}

// ---- Customers ----
export async function fetchCustomers(companyId?: string): Promise<Customer[]> {
  let q = supabase.from('customers').select('*').order('name');
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as Customer[];
}

export async function createCustomer(c: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
  const { data, error } = await supabase.from('customers').insert(c).select().single();
  if (error) throw error;
  return data as Customer;
}

// ---- Suppliers ----
export async function fetchSuppliers(companyId?: string): Promise<Supplier[]> {
  let q = supabase.from('suppliers').select('*').order('name');
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(s: Omit<Supplier, 'id' | 'created_at'>): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').insert(s).select().single();
  if (error) throw error;
  return data as Supplier;
}

// ---- Movements ----
export async function fetchMovements(companyId?: string, limit = 100): Promise<(Movement & { product: Product; company: Company; origin_warehouse?: Warehouse; dest_warehouse?: Warehouse })[]> {
  let q = supabase
    .from('movements')
    .select('*, product:products(*), company:companies(*), origin_warehouse:warehouses!movements_origin_warehouse_id_fkey(*), dest_warehouse:warehouses!movements_dest_warehouse_id_fkey(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

// ---- Purchases ----
export async function fetchPurchases(companyId?: string): Promise<(Purchase & { company: Company; warehouse: Warehouse; supplier: Supplier | null })[]> {
  let q = supabase
    .from('purchases')
    .select('*, company:companies(*), warehouse:warehouses(*), supplier:suppliers(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function registerPurchase(
  companyId: string,
  warehouseId: string,
  supplierId: string | null,
  purchaseDate: string,
  paymentType: 'contado' | 'credito',
  items: PurchaseItem[],
  notes: string | null,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_purchase', {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_supplier_id: supplierId,
    p_purchase_date: purchaseDate,
    p_payment_type: paymentType,
    p_items: JSON.stringify(items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
    }))) as any,
    p_notes: notes,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Sales ----
export async function fetchSales(companyId?: string): Promise<(Sale & { company: Company; warehouse: Warehouse; customer: Customer | null })[]> {
  let q = supabase
    .from('sales')
    .select('*, company:companies(*), warehouse:warehouses(*), customer:customers(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function registerSale(
  companyId: string,
  warehouseId: string,
  customerId: string | null,
  saleDate: string,
  paymentType: 'contado' | 'credito',
  items: SaleItem[],
  paidAmount: number,
  notes: string | null,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_sale', {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_customer_id: customerId,
    p_sale_date: saleDate,
    p_payment_type: paymentType,
    p_items: JSON.stringify(items.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }))) as any,
    p_paid_amount: paidAmount,
    p_notes: notes,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Transfers ----
export async function registerTransfer(
  originWarehouseId: string,
  destWarehouseId: string,
  productId: string,
  quantity: number,
  transferDate: string,
  observations: string | null,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_transfer', {
    p_origin_warehouse_id: originWarehouseId,
    p_dest_warehouse_id: destWarehouseId,
    p_product_id: productId,
    p_quantity: quantity,
    p_transfer_date: transferDate,
    p_observations: observations,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Inventory Adjustment ----
export async function registerAdjustment(
  companyId: string,
  warehouseId: string,
  productId: string,
  quantity: number,
  type: 'entrada' | 'salida',
  adjDate: string,
  observations: string | null,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_inventory_adjustment', {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_product_id: productId,
    p_quantity: quantity,
    p_type: type,
    p_adj_date: adjDate,
    p_observations: observations,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Invoices (Receivables) ----
export async function fetchInvoices(companyId?: string): Promise<(Invoice & { company: Company; customer: Customer })[]> {
  let q = supabase
    .from('invoices')
    .select('*, company:companies(*), customer:customers(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function registerCustomerPayment(
  invoiceId: string,
  amount: number,
  paymentDate: string,
  method: string,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_customer_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_method: method,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

export async function fetchPayments(invoiceId?: string): Promise<Payment[]> {
  let q = supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (invoiceId) q = q.eq('invoice_id', invoiceId);
  const { data, error } = await q;
  if (error) throw error;
  return data as Payment[];
}

// ---- Payable Invoices ----
export async function fetchPayableInvoices(companyId?: string): Promise<(PayableInvoice & { company: Company; supplier: Supplier })[]> {
  let q = supabase
    .from('payable_invoices')
    .select('*, company:companies(*), supplier:suppliers(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function registerSupplierPayment(
  payableInvoiceId: string,
  amount: number,
  paymentDate: string,
  method: string,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_supplier_payment', {
    p_payable_invoice_id: payableInvoiceId,
    p_amount: amount,
    p_payment_date: paymentDate,
    p_method: method,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Expenses ----
export async function fetchExpenses(companyId?: string): Promise<(Expense & { company: Company })[]> {
  let q = supabase
    .from('expenses')
    .select('*, company:companies(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function createExpense(
  companyId: string,
  expenseDate: string,
  category: string,
  description: string | null,
  amount: number,
  userName: string
): Promise<Expense> {
  const { data: seq } = await supabase.rpc('get_next_doc_number', {
    p_prefix: 'GAS',
    p_company_id: companyId,
    p_doc_type: 'expense',
  });
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      number: seq,
      company_id: companyId,
      expense_date: expenseDate,
      category,
      description,
      amount,
      user_name: userName,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

// ---- Incomes ----
export async function fetchIncomes(companyId?: string): Promise<(Income & { company: Company })[]> {
  let q = supabase
    .from('incomes')
    .select('*, company:companies(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function createIncome(
  companyId: string,
  incomeDate: string,
  category: string,
  description: string | null,
  amount: number,
  userName: string
): Promise<Income> {
  const { data: seq } = await supabase.rpc('get_next_doc_number', {
    p_prefix: 'ING',
    p_company_id: companyId,
    p_doc_type: 'income',
  });
  const { data, error } = await supabase
    .from('incomes')
    .insert({
      number: seq,
      company_id: companyId,
      income_date: incomeDate,
      category,
      description,
      amount,
      user_name: userName,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Income;
}

// ---- Transfer Requests (Handshake) ----
export async function fetchTransferRequests(): Promise<(TransferRequest & { product: Product; origin_warehouse: Warehouse; dest_warehouse: Warehouse })[]> {
  const { data, error } = await supabase
    .from('transfer_requests')
    .select('*, product:products(*), origin_warehouse:warehouses!transfer_requests_origin_warehouse_id_fkey(*), dest_warehouse:warehouses!transfer_requests_dest_warehouse_id_fkey(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as any;
}

export async function createTransferRequest(
  originWarehouseId: string,
  destWarehouseId: string,
  productId: string,
  quantity: number,
  observations: string | null,
  userName: string
): Promise<TransferRequest> {
  const { data: seq } = await supabase.rpc('get_next_doc_number', {
    p_prefix: 'TRQ',
    p_company_id: null as any,
    p_doc_type: 'transfer_request',
  });
  const { data, error } = await supabase
    .from('transfer_requests')
    .insert({
      number: seq,
      origin_warehouse_id: originWarehouseId,
      dest_warehouse_id: destWarehouseId,
      product_id: productId,
      quantity,
      status: 'solicitada',
      requested_by: userName,
      observations,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TransferRequest;
}

export async function dispatchTransferRequest(requestId: string, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('dispatch_transfer_request', {
    p_request_id: requestId,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

export async function receiveTransferRequest(requestId: string, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('receive_transfer_request', {
    p_request_id: requestId,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Supply Requests ----
export async function fetchSupplyRequests(companyId?: string, asSupplier?: boolean): Promise<SupplyRequest[]> {
  let q = supabase
    .from('supply_requests')
    .select('*, requestor_company:companies!supply_requests_requestor_company_id_fkey(*), supplier_company:companies!supply_requests_supplier_company_id_fkey(*), requestor_warehouse:warehouses!supply_requests_requestor_warehouse_id_fkey(*)')
    .order('created_at', { ascending: false });
  if (companyId) {
    if (asSupplier) q = q.eq('supplier_company_id', companyId);
    else q = q.eq('requestor_company_id', companyId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function createSupplyRequest(
  requestorCompanyId: string,
  requestorWarehouseId: string,
  supplierCompanyId: string,
  items: SupplyRequestItem[],
  notes: string | null,
  userName: string
): Promise<SupplyRequest> {
  const { data: seq } = await supabase.rpc('get_next_doc_number', {
    p_prefix: 'SOL',
    p_company_id: requestorCompanyId,
    p_doc_type: 'supply_request',
  });
  const { data, error } = await supabase
    .from('supply_requests')
    .insert({
      number: seq,
      requestor_company_id: requestorCompanyId,
      requestor_warehouse_id: requestorWarehouseId,
      supplier_company_id: supplierCompanyId,
      items: JSON.stringify(items) as any,
      status: 'solicitada',
      requested_by: userName,
      notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SupplyRequest;
}

export async function approveSupplyRequest(id: string, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('approve_supply_request', { p_request_id: id, p_user_name: userName });
  if (error) throw error;
  return data;
}

export async function rejectSupplyRequest(id: string, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('reject_supply_request', { p_request_id: id, p_user_name: userName });
  if (error) throw error;
  return data;
}

export async function dispatchSupplyRequest(id: string, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('dispatch_supply_request', { p_request_id: id, p_user_name: userName });
  if (error) throw error;
  return data;
}

export async function receiveSupplyRequest(id: string, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('receive_supply_request', { p_request_id: id, p_user_name: userName });
  if (error) throw error;
  return data;
}

// ---- Mermas ----
export async function fetchMermas(companyId?: string): Promise<(Movement & { product: Product; company: Company })[]> {
  let q = supabase
    .from('movements')
    .select('*, product:products(*), company:companies(*)')
    .eq('type', 'merma')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function registerMerma(
  companyId: string,
  warehouseId: string,
  productId: string,
  quantity: number,
  reason: string,
  userName: string
): Promise<any> {
  const { data, error } = await supabase.rpc('register_merma', {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_product_id: productId,
    p_quantity: quantity,
    p_reason: reason,
    p_merma_date: new Date().toISOString().slice(0, 10),
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

// ---- Cash Registers ----
export async function fetchCashRegisters(companyId?: string): Promise<CashRegister[]> {
  let q = supabase.from('cash_registers').select('*').order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as CashRegister[];
}

export async function openCashRegister(companyId: string, warehouseId: string, openingAmount: number, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('open_cash_register', {
    p_company_id: companyId,
    p_warehouse_id: warehouseId,
    p_opening_amount: openingAmount,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}

export async function closeCashRegister(registerId: string, countedTotal: number, userName: string, notes: string | null): Promise<any> {
  const { data, error } = await supabase.rpc('close_cash_register', {
    p_register_id: registerId,
    p_counted_total: countedTotal,
    p_user_name: userName,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

// ---- Cash Movements ----
export async function fetchCashMovements(cashRegisterId: string): Promise<CashMovement[]> {
  const { data, error } = await supabase
    .from('cash_movements')
    .select('*')
    .eq('cash_register_id', cashRegisterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as CashMovement[];
}

export async function createCashMovement(
  cashRegisterId: string,
  companyId: string,
  type: 'ingreso' | 'egreso',
  category: string,
  description: string | null,
  amount: number,
  userName: string
): Promise<CashMovement> {
  const { data: seq } = await supabase.rpc('get_next_doc_number', {
    p_prefix: type === 'ingreso' ? 'CIN' : 'CEG',
    p_company_id: companyId,
    p_doc_type: type === 'ingreso' ? 'cash_ingreso' : 'cash_egreso',
  });
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      number: seq,
      cash_register_id: cashRegisterId,
      company_id: companyId,
      type,
      category,
      description,
      amount,
      user_name: userName,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CashMovement;
}

// ---- Recipes ----
export async function fetchRecipes(companyId?: string): Promise<(Recipe & { output_product: Product })[]> {
  let q = supabase
    .from('recipes')
    .select('*, output_product:products!recipes_output_product_id_fkey(*)')
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  const { data, error } = await q;
  if (error) throw error;
  return data as any;
}

export async function createRecipe(
  companyId: string,
  name: string,
  outputProductId: string,
  outputQuantity: number,
  ingredients: RecipeIngredient[]
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      company_id: companyId,
      name,
      output_product_id: outputProductId,
      output_quantity: outputQuantity,
      ingredients: JSON.stringify(ingredients) as any,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Recipe;
}

export async function applyRecipe(recipeId: string, warehouseId: string, companyId: string, batches: number, userName: string): Promise<any> {
  const { data, error } = await supabase.rpc('apply_recipe', {
    p_recipe_id: recipeId,
    p_warehouse_id: warehouseId,
    p_company_id: companyId,
    p_batches: batches,
    p_user_name: userName,
  });
  if (error) throw error;
  return data;
}
