import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { Trash2, Plus, AlertTriangle } from 'lucide-react';
import type { Product, Warehouse, Movement } from '@/types';
import { fetchProducts, fetchWarehouses, fetchMermas, registerMerma } from '@/lib/data';

const MERMA_REASONS = ['Daño', 'Caducidad', 'Control de Calidad', 'Derrame', 'Robo', 'Otro'];

export function MermasView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [mermas, setMermas] = useState<(Movement & { product: Product; company: { name: string } })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ms, prods] = await Promise.all([
        fetchMermas(selectedCompanyId || undefined),
        fetchProducts(),
      ]);
      setMermas(ms);
      setProducts(prods);
      if (selectedCompanyId) {
        const whs = await fetchWarehouses(selectedCompanyId);
        setWarehouses(whs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const totalUnits = mermas.reduce((s, m) => s + m.quantity, 0);
  const totalValue = mermas.reduce((s, m) => s + m.quantity * Number(m.unit_cost || m.product?.cost_price || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mermas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Mermas consolidadas del Grupo JYC' : `Mermas de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && selectedCompanyId && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Registrar Merma
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gray-500">Total Unidades Mermadas</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{formatNumber(totalUnits)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Valor Total de Mermas</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totalValue)}</p>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando mermas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  {isGlobal && <th className="pb-2 pr-4 font-medium">Empresa</th>}
                  <th className="pb-2 pr-4 font-medium">Producto</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cantidad</th>
                  <th className="pb-2 pr-4 font-medium">Motivo</th>
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mermas.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{m.number}</td>
                    {isGlobal && <td className="py-3 pr-4 text-gray-700">{m.company?.name}</td>}
                    <td className="py-3 pr-4 font-medium text-gray-900">{m.product?.name}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-red-600">{formatNumber(m.quantity)}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                        <AlertTriangle size={12} /> {m.observations || 'Merma'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(m.movement_date)}</td>
                    <td className="py-3 text-gray-500 text-xs">{m.user_name}</td>
                  </tr>
                ))}
                {mermas.length === 0 && (
                  <tr><td colSpan={isGlobal ? 7 : 6} className="py-8 text-center text-gray-400">Sin mermas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && selectedCompanyId && (
        <MermaModal
          products={products}
          warehouses={warehouses}
          companyId={selectedCompanyId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function MermaModal({ products, warehouses, companyId, onClose, onSaved }: {
  products: Product[];
  warehouses: Warehouse[];
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState(MERMA_REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await registerMerma(companyId, warehouseId, productId, quantity, reason, 'Administrador');
      if (!result.success) { setError(result.error); return; }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Registrar Merma">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          La merma reduce el inventario global del ecosistema. Esta acción no se puede deshacer.
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Bodega</span>
          <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Producto</span>
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
            <option value="">Seleccionar...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Cantidad</span>
          <input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Motivo</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
            {MERMA_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <Trash2 size={16} /> {saving ? 'Procesando...' : 'Registrar Merma'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
