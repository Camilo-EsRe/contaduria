import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatNumber } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import type { Product, Warehouse, Inventory } from '@/types';
import { fetchProducts, createProduct, registerAdjustment } from '@/lib/data';

export function InventoryView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<(Inventory & { product: Product; warehouse: Warehouse & { company: { id: string; name: string } } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [adjustmentModal, setAdjustmentModal] = useState<{ product: Product; warehouseId: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const prods = await fetchProducts();
      setProducts(prods);

      const { data, error } = await supabase
        .from('inventory')
        .select('*, product:products(*), warehouse:warehouses(*, company:companies(*))')
        .order('created_at');
      if (error) throw error;
      const allInv = (data || []) as any[];
      const filtered = selectedCompanyId
        ? allInv.filter((r) => r.warehouse?.company?.id === selectedCompanyId)
        : allInv;
      setInventory(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  // Filter inventory based on selected company
  const filteredInventory = inventory;

  const searched = filteredInventory.filter((i) =>
    !search || i.product?.name.toLowerCase().includes(search.toLowerCase()) ||
    i.product?.sku.toLowerCase().includes(search.toLowerCase())
  );

  // Group by product for consolidated view
  const consolidatedByProduct = isGlobal ? (() => {
    const map = new Map<string, { product: Product; totalQty: number; byCompany: { company: string; qty: number }[] }>();
    for (const i of searched) {
      const existing = map.get(i.product_id) || { product: i.product, totalQty: 0, byCompany: [] };
      existing.totalQty += i.quantity;
      const compName = i.warehouse?.company?.name || 'N/A';
      const compEntry = existing.byCompany.find((c) => c.company === compName);
      if (compEntry) compEntry.qty += i.quantity;
      else existing.byCompany.push({ company: compName, qty: i.quantity });
      map.set(i.product_id, existing);
    }
    return Array.from(map.values());
  })() : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Vista consolidada de todo el Grupo JYC' : `Inventario de ${selectedCompany?.name}`}
          </p>
        </div>
        <Button onClick={() => setShowProductModal(true)}>
          <Plus size={16} /> Nuevo Producto
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando inventario...</div>
      ) : isGlobal && consolidatedByProduct ? (
        /* Consolidated view grouped by product */
        <Card title="Inventario Consolidado por Producto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Producto</th>
                  <th className="pb-2 pr-4 font-medium">SKU</th>
                  <th className="pb-2 pr-4 font-medium">Unidad</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium">Distribución por Empresa</th>
                  <th className="pb-2 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {consolidatedByProduct.map((row) => (
                  <tr key={row.product.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{row.product.name}</td>
                    <td className="py-3 pr-4 text-gray-500">{row.product.sku}</td>
                    <td className="py-3 pr-4 text-gray-500">{row.product.unit}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900">{formatNumber(row.totalQty)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {row.byCompany.map((c) => (
                          <span key={c.company} className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {c.company}: {c.qty}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-700">
                      {formatCurrency(row.totalQty * row.product.cost_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Per-company view with warehouse detail and adjustment actions */
        <Card title="Inventario por Bodega">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Producto</th>
                  <th className="pb-2 pr-4 font-medium">SKU</th>
                  <th className="pb-2 pr-4 font-medium">Bodega</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cantidad</th>
                  <th className="pb-2 pr-4 font-medium text-right">Mín.</th>
                  <th className="pb-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {searched.map((row) => {
                  const isLow = row.quantity <= row.product.min_stock;
                  return (
                    <tr key={row.id} className={isLow ? 'bg-amber-50/50' : ''}>
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {isLow && <AlertTriangle size={14} className="text-amber-500" />}
                          {row.product.name}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{row.product.sku}</td>
                      <td className="py-3 pr-4 text-gray-500">{row.warehouse?.name}</td>
                      <td className={`py-3 pr-4 text-right font-semibold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                        {formatNumber(row.quantity)}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-400">{row.product.min_stock}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setAdjustmentModal({ product: row.product, warehouseId: row.warehouse_id })}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            title="Entrada"
                          >
                            <ArrowDownCircle size={18} />
                          </button>
                          <button
                            onClick={() => setAdjustmentModal({ product: row.product, warehouseId: row.warehouse_id })}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                            title="Salida"
                          >
                            <ArrowUpCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {searched.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">Sin inventario registrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showProductModal && (
        <ProductModal
          onClose={() => setShowProductModal(false)}
          onSaved={() => { setShowProductModal(false); load(); }}
        />
      )}

      {adjustmentModal && (
        <AdjustmentModal
          product={adjustmentModal.product}
          warehouseId={adjustmentModal.warehouseId}
          companyId={selectedCompanyId!}
          onClose={() => setAdjustmentModal(null)}
          onSaved={() => { setAdjustmentModal(null); load(); }}
        />
      )}
    </div>
  );
}

function ProductModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    sku: '',
    name: '',
    unit: 'unidad',
    category: '',
    cost_price: 0,
    sale_price: 0,
    min_stock: 5,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProduct({
        ...form,
        is_active: true,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nuevo Producto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU">
            <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="input" />
          </Field>
          <Field label="Unidad">
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="input" />
          </Field>
        </div>
        <Field label="Nombre">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input" />
        </Field>
        <Field label="Categoría">
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Costo">
            <input type="number" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
              className="input" />
          </Field>
          <Field label="Precio Venta">
            <input type="number" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
              className="input" />
          </Field>
          <Field label="Stock Mínimo">
            <input type="number" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
              className="input" />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear Producto'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustmentModal({ product, warehouseId, companyId, onClose, onSaved }: {
  product: Product;
  warehouseId: string;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<'entrada' | 'salida'>('entrada');
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await registerAdjustment(companyId, warehouseId, product.id, quantity, type, new Date().toISOString().slice(0, 10), observations, 'Administrador');
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Ajuste de Inventario — ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType('entrada')}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
              type === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'
            }`}
          >
            <ArrowDownCircle size={20} className="mx-auto mb-1" />
            Entrada (+)
          </button>
          <button
            type="button"
            onClick={() => setType('salida')}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
              type === 'salida' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
            }`}
          >
            <ArrowUpCircle size={20} className="mx-auto mb-1" />
            Salida (−)
          </button>
        </div>
        <Field label="Cantidad">
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="input" />
        </Field>
        <Field label="Observaciones">
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className="input" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Procesando...' : 'Registrar Ajuste'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
