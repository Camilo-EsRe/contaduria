import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
  FileText,
  Receipt,
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Movement, Product, Inventory } from '@/types';

interface DashboardData {
  totalProducts: number;
  totalInventoryUnits: number;
  totalInventoryValue: number;
  totalPurchases: number;
  totalSales: number;
  totalExpenses: number;
  totalIncomes: number;
  totalReceivables: number;
  totalPayables: number;
  overdueReceivables: number;
  lowStockItems: { product: Product; quantity: number; warehouse: string; company: string }[];
  recentMovements: (Movement & { product: Product; company: { name: string }; origin_warehouse?: { name: string }; dest_warehouse?: { name: string } })[];
}

export function DashboardView() {
  const { isGlobal, selectedCompanyId, companies, selectedCompany } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch inventory - fetch all and filter in JS (Supabase can't filter on nested join columns)
        const { data: invData } = await supabase
          .from('inventory')
          .select('quantity, product:products(*), warehouse:warehouses(name, company:companies(name, id))');

        const inventoryRows = ((invData || []) as any[]).filter(
          (r) => !selectedCompanyId || r.warehouse?.company?.id === selectedCompanyId
        );
        const totalInventoryUnits = inventoryRows.reduce((s, r) => s + r.quantity, 0);
        const totalInventoryValue = inventoryRows.reduce((s, r) => s + r.quantity * (r.product?.cost_price || 0), 0);

        // Low stock
        const lowStockItems = inventoryRows
          .filter((r) => r.product && r.quantity <= r.product.min_stock)
          .map((r) => ({
            product: r.product,
            quantity: r.quantity,
            warehouse: r.warehouse?.name || '',
            company: r.warehouse?.company?.name || '',
          }));

        // Fetch purchases
        let purchaseQuery = supabase.from('purchases').select('total');
        if (selectedCompanyId) purchaseQuery = purchaseQuery.eq('company_id', selectedCompanyId);
        const { data: purchases } = await purchaseQuery;
        const totalPurchases = (purchases || []).reduce((s: number, r: any) => s + Number(r.total), 0);

        // Fetch sales
        let salesQuery = supabase.from('sales').select('total');
        if (selectedCompanyId) salesQuery = salesQuery.eq('company_id', selectedCompanyId);
        const { data: sales } = await salesQuery;
        const totalSales = (sales || []).reduce((s: number, r: any) => s + Number(r.total), 0);

        // Fetch expenses
        let expQuery = supabase.from('expenses').select('amount');
        if (selectedCompanyId) expQuery = expQuery.eq('company_id', selectedCompanyId);
        const { data: expenses } = await expQuery;
        const totalExpenses = (expenses || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

        // Fetch incomes
        let incQuery = supabase.from('incomes').select('amount');
        if (selectedCompanyId) incQuery = incQuery.eq('company_id', selectedCompanyId);
        const { data: incomes } = await incQuery;
        const totalIncomes = (incomes || []).reduce((s: number, r: any) => s + Number(r.amount), 0);

        // Receivables
        let invInvQuery = supabase.from('invoices').select('balance, due_date, status');
        if (selectedCompanyId) invInvQuery = invInvQuery.eq('company_id', selectedCompanyId);
        const { data: receivables } = await invInvQuery;
        const totalReceivables = (receivables || []).reduce((s: number, r: any) => s + Number(r.balance), 0);
        const today = new Date().toISOString().slice(0, 10);
        const overdueReceivables = (receivables || [])
          .filter((r: any) => r.status === 'pendiente' && r.due_date && r.due_date < today)
          .reduce((s: number, r: any) => s + Number(r.balance), 0);

        // Payables
        let payQuery = supabase.from('payable_invoices').select('balance, due_date, status');
        if (selectedCompanyId) payQuery = payQuery.eq('company_id', selectedCompanyId);
        const { data: payables } = await payQuery;
        const totalPayables = (payables || []).reduce((s: number, r: any) => s + Number(r.balance), 0);

        // Recent movements
        let movQuery = supabase
          .from('movements')
          .select('*, product:products(*), company:companies(name), origin_warehouse:warehouses!movements_origin_warehouse_id_fkey(name), dest_warehouse:warehouses!movements_dest_warehouse_id_fkey(name)')
          .order('created_at', { ascending: false })
          .limit(15);
        if (selectedCompanyId) movQuery = movQuery.eq('company_id', selectedCompanyId);
        const { data: movData } = await movQuery;
        const recentMovements = (movData || []) as any[];

        // Total products
        const { count: totalProducts } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        setData({
          totalProducts: totalProducts || 0,
          totalInventoryUnits,
          totalInventoryValue,
          totalPurchases,
          totalSales,
          totalExpenses,
          totalIncomes,
          totalReceivables,
          totalPayables,
          overdueReceivables,
          lowStockItems,
          recentMovements,
        });
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedCompanyId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-400">Cargando dashboard...</div>
      </div>
    );
  }

  const title = isGlobal ? 'Dashboard Consolidado — Grupo JYC' : `Dashboard — ${selectedCompany?.name}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isGlobal
            ? 'Vista global de todas las empresas del grupo'
            : `Información exclusiva de ${selectedCompany?.name}`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Inventario Total (unidades)"
          value={formatNumber(data?.totalInventoryUnits || 0)}
          icon={<Package size={20} />}
          color="blue"
          trend={`Valor: ${formatCurrency(data?.totalInventoryValue || 0)}`}
        />
        <StatCard
          label="Ventas Totales"
          value={formatCurrency(data?.totalSales || 0)}
          icon={<TrendingUp size={20} />}
          color="green"
        />
        <StatCard
          label="Compras Totales"
          value={formatCurrency(data?.totalPurchases || 0)}
          icon={<ShoppingCart size={20} />}
          color="teal"
        />
        <StatCard
          label="Ingresos"
          value={formatCurrency(data?.totalIncomes || 0)}
          icon={<Banknote size={20} />}
          color="green"
        />
        <StatCard
          label="Gastos / Egresos"
          value={formatCurrency(data?.totalExpenses || 0)}
          icon={<Wallet size={20} />}
          color="amber"
        />
        <StatCard
          label="Cuentas por Cobrar"
          value={formatCurrency(data?.totalReceivables || 0)}
          icon={<FileText size={20} />}
          color="teal"
          trend={data?.overdueReceivables ? `Vencido: ${formatCurrency(data.overdueReceivables)}` : undefined}
        />
        <StatCard
          label="Cuentas por Pagar"
          value={formatCurrency(data?.totalPayables || 0)}
          icon={<Receipt size={20} />}
          color="red"
        />
        <StatCard
          label="Productos Catálogo"
          value={formatNumber(data?.totalProducts || 0)}
          icon={<Package size={20} />}
          color="slate"
        />
      </div>

      {/* P&L Summary */}
      <Card title="Resumen Financiero (P&L)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600">Ingresos Totales</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {formatCurrency((data?.totalSales || 0) + (data?.totalIncomes || 0))}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-600">Gastos Totales</p>
            <p className="mt-1 text-lg font-bold text-amber-700">
              {formatCurrency((data?.totalExpenses || 0) + (data?.totalPurchases || 0))}
            </p>
          </div>
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-teal-600">Utilidad Neta</p>
            <p className="mt-1 text-lg font-bold text-teal-700">
              {formatCurrency(
                (data?.totalSales || 0) + (data?.totalIncomes || 0)
                - (data?.totalExpenses || 0) - (data?.totalPurchases || 0)
              )}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-600">Flujo de Caja</p>
            <p className="mt-1 text-lg font-bold text-blue-700">
              {formatCurrency(
                (data?.totalReceivables || 0) - (data?.totalPayables || 0)
              )}
            </p>
            <p className="text-xs text-gray-400">CxC - CxP</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low stock alerts */}
        <Card
          title="Alertas de Inventario Bajo"
          actions={<AlertTriangle size={18} className="text-amber-500" />}
        >
          {data?.lowStockItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay productos con stock bajo</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data?.lowStockItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.company} — {item.warehouse}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-amber-600">{item.quantity}</p>
                    <p className="text-xs text-gray-400">Min: {item.product.min_stock}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent movements */}
        <Card
          title="Movimientos Recientes"
          actions={<ArrowLeftRight size={18} className="text-gray-400" />}
        >
          {data?.recentMovements.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin movimientos</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data?.recentMovements.map((mov) => (
                <div key={mov.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        mov.type === 'compra' || mov.type === 'entrada' ? 'bg-emerald-100 text-emerald-700' :
                        mov.type === 'venta' || mov.type === 'salida' ? 'bg-red-100 text-red-700' :
                        mov.type === 'transferencia' ? 'bg-blue-100 text-blue-700' :
                        mov.type === 'merma' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {mov.type}
                      </span>
                      <p className="text-sm font-medium text-gray-900 truncate">{mov.product?.name}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {mov.number} · {mov.company?.name} · {formatDate(mov.movement_date)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-gray-700">
                    {mov.type === 'salida' || mov.type === 'venta' || mov.type === 'merma' ? '-' : '+'}
                    {mov.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Inventory by company (only in global view) */}
      {isGlobal && <InventoryByCompany companies={companies} />}
    </div>
  );
}

function InventoryByCompany({ companies }: { companies: { id: string; name: string }[] }) {
  const [companyInv, setCompanyInv] = useState<{ name: string; units: number; value: number }[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('inventory')
        .select('quantity, product:products(cost_price), warehouse:warehouses(company:companies(name))');
      const rows = (data || []) as any[];
      const byCompany = new Map<string, { units: number; value: number }>();
      for (const r of rows) {
        const name = r.warehouse?.company?.name || 'Sin empresa';
        const existing = byCompany.get(name) || { units: 0, value: 0 };
        existing.units += r.quantity;
        existing.value += r.quantity * (r.product?.cost_price || 0);
        byCompany.set(name, existing);
      }
      setCompanyInv(Array.from(byCompany.entries()).map(([name, v]) => ({ name, ...v })));
    }
    load();
  }, []);

  if (companyInv.length === 0) return null;

  return (
    <Card title="Inventario por Empresa">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="pb-2 pr-4 font-medium">Empresa</th>
              <th className="pb-2 pr-4 font-medium text-right">Unidades</th>
              <th className="pb-2 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {companyInv.map((c) => (
              <tr key={c.name}>
                <td className="py-2.5 pr-4 font-medium text-gray-900">{c.name}</td>
                <td className="py-2.5 pr-4 text-right text-gray-700">{formatNumber(c.units)}</td>
                <td className="py-2.5 text-right text-gray-700">{formatCurrency(c.value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-semibold">
              <td className="pt-2.5 pr-4 text-gray-900">Total Grupo JYC</td>
              <td className="pt-2.5 pr-4 text-right text-gray-900">
                {formatNumber(companyInv.reduce((s, c) => s + c.units, 0))}
              </td>
              <td className="pt-2.5 text-right text-gray-900">
                {formatCurrency(companyInv.reduce((s, c) => s + c.value, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
