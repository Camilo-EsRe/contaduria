import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/format';
import { TrendingUp, Plus, Trash2, Eye } from 'lucide-react';
import type { Product, Customer, Warehouse, Sale, SaleItem } from '@/types';
import { fetchProducts, fetchCustomers, fetchWarehouses, fetchSales, registerSale } from '@/lib/data';

export function SalesView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [sales, setSales] = useState<(Sale & { company: { name: string }; warehouse: { name: string }; customer: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSales(selectedCompanyId || undefined);
      setSales(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const totalSales = sales.reduce((s, p) => s + Number(p.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Todas las ventas del Grupo JYC' : `Ventas de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva Venta
          </Button>
        )}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">{sales.length} venta(s) registrada(s)</p>
          <p className="text-lg font-bold text-gray-900">Total: {formatCurrency(totalSales)}</p>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando ventas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  {isGlobal && <th className="pb-2 pr-4 font-medium">Empresa</th>}
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Pago</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{s.number}</td>
                    {isGlobal && <td className="py-3 pr-4 text-gray-700">{s.company?.name}</td>}
                    <td className="py-3 pr-4 text-gray-700">{s.customer?.name || 'Contado'}</td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(s.sale_date)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        s.payment_type === 'credito' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>{s.payment_type}</span>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900">{formatCurrency(s.total)}</td>
                    <td className="py-3">
                      <button onClick={() => setDetailSale(s)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr><td colSpan={isGlobal ? 7 : 6} className="py-8 text-center text-gray-400">Sin ventas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && selectedCompanyId && (
        <SaleModal
          companyId={selectedCompanyId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {detailSale && (
        <Modal open={true} onClose={() => setDetailSale(null)} title={`Detalle Venta ${detailSale.number}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-400">Fecha</p><p className="font-medium text-gray-900">{formatDate(detailSale.sale_date)}</p></div>
              <div><p className="text-gray-400">Tipo de Pago</p><p className="font-medium text-gray-900 capitalize">{detailSale.payment_type}</p></div>
              <div><p className="text-gray-400">Pagado</p><p className="font-medium text-gray-900">{formatCurrency(detailSale.paid_amount)}</p></div>
              <div><p className="text-gray-400">Estado</p><p className="font-medium text-gray-900 capitalize">{detailSale.status}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 font-medium text-right">Cant.</th>
                    <th className="pb-2 font-medium text-right">Precio Unit.</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(detailSale.items as unknown as SaleItem[]).map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-gray-900">{item.product_name}</td>
                      <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(item.quantity * item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 pt-3 text-right">
              <p className="text-lg font-bold text-gray-900">Total: {formatCurrency(detailSale.total)}</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SaleModal({ companyId, onClose, onSaved }: { companyId: string; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'contado' | 'credito'>('contado');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCustomers(companyId), fetchWarehouses(companyId)])
      .then(([p, c, w]) => {
        setProducts(p);
        setCustomers(c);
        setWarehouses(w);
        if (w.length > 0) setWarehouseId(w[0].id);
      });
  }, [companyId]);

  const addItem = () => {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product || qty < 1) return;
    setItems([...items, { product_id: product.id, product_name: product.name, quantity: qty, unit_price: price || product.sale_price }]);
    setSelectedProduct('');
    setQty(1);
    setPrice(0);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { setError('Agregue al menos un producto'); return; }
    if (paymentType === 'credito' && !customerId) { setError('Las ventas a crédito requieren un cliente'); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await registerSale(companyId, warehouseId, customerId || null, new Date().toISOString().slice(0, 10), paymentType, items, paidAmount, notes, 'Administrador');
      if (!result.success) { setError(result.error); return; }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nueva Venta" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Bodega</span>
            <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Cliente</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
              <option value="">Venta de contado (sin cliente)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => setPaymentType('contado')}
            className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium ${paymentType === 'contado' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500'}`}>
            Contado
          </button>
          <button type="button" onClick={() => setPaymentType('credito')}
            className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium ${paymentType === 'credito' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500'}`}>
            Crédito
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">Agregar Producto</p>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
              <select value={selectedProduct} onChange={(e) => {
                setSelectedProduct(e.target.value);
                const p = products.find((x) => x.id === e.target.value);
                if (p) setPrice(p.sale_price);
              }} className="input">
                <option value="">Seleccionar...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <input type="number" min="1" placeholder="Cant." value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input" />
            </div>
            <div className="col-span-3">
              <input type="number" min="0" placeholder="Precio unit." value={price} onChange={(e) => setPrice(Number(e.target.value))} className="input" />
            </div>
            <div className="col-span-2">
              <Button type="button" variant="secondary" onClick={addItem} className="w-full">Agregar</Button>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 font-medium text-right">Cant.</th>
                  <th className="px-3 py-2 font-medium text-right">Precio</th>
                  <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.quantity * item.unit_price)}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 font-bold">
                  <td colSpan={3} className="px-3 py-2 text-right">Total:</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {paymentType === 'credito' && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Monto Pagado (Abono Inicial)</span>
            <input type="number" min="0" max={total} value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} className="input" />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Notas</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </label>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <TrendingUp size={16} /> {saving ? 'Procesando...' : 'Registrar Venta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
