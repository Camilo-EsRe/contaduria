import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatNumber, formatDate } from '@/lib/format';
import {
  ArrowLeftRight,
  Plus,
  Filter,
  ArrowRight,
} from 'lucide-react';
import type { Product, Movement, Warehouse } from '@/types';
import { fetchProducts, fetchMovements, registerTransfer, fetchAllWarehousesWithCompany } from '@/lib/data';

export function MovementsView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [movements, setMovements] = useState<(Movement & { product: Product; company: { name: string }; origin_warehouse?: { name: string }; dest_warehouse?: { name: string } })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<(Warehouse & { company: { id: string; name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const [movs, prods, whs] = await Promise.all([
        fetchMovements(selectedCompanyId || undefined, 200),
        fetchProducts(),
        fetchAllWarehousesWithCompany(),
      ]);
      setMovements(movs);
      setProducts(prods);
      setWarehouses(whs as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const filtered = filterType ? movements.filter((m) => m.type === filterType) : movements;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimientos / Transferencias</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Historial de todos los movimientos del Grupo JYC' : `Movimientos de ${selectedCompany?.name}`}
          </p>
        </div>
        <Button onClick={() => setShowTransferModal(true)}>
          <Plus size={16} /> Nueva Transferencia
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter size={18} className="text-gray-400" />
        <div className="flex flex-wrap gap-2">
          {['', 'compra', 'venta', 'transferencia', 'entrada', 'salida', 'ajuste', 'merma'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filterType === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === '' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando movimientos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 pr-4 font-medium">Empresa</th>
                  <th className="pb-2 pr-4 font-medium">Producto</th>
                  <th className="pb-2 pr-4 font-medium">Ruta</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cantidad</th>
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{mov.number}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        mov.type === 'compra' || mov.type === 'entrada' ? 'bg-emerald-100 text-emerald-700' :
                        mov.type === 'venta' || mov.type === 'salida' ? 'bg-red-100 text-red-700' :
                        mov.type === 'transferencia' ? 'bg-blue-100 text-blue-700' :
                        mov.type === 'merma' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {mov.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{mov.company?.name}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{mov.product?.name}</td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {mov.origin_warehouse?.name}
                      {mov.dest_warehouse && (
                        <>
                          <ArrowRight size={12} className="inline mx-1" />
                          {mov.dest_warehouse.name}
                        </>
                      )}
                    </td>
                    <td className={`py-3 pr-4 text-right font-semibold ${
                      mov.type === 'salida' || mov.type === 'venta' || mov.type === 'merma' ? 'text-red-600' :
                      mov.type === 'transferencia' ? 'text-blue-600' : 'text-emerald-600'
                    }`}>
                      {mov.type === 'salida' || mov.type === 'venta' || mov.type === 'merma' ? '-' : ''}
                      {mov.type === 'transferencia' ? '' : ''}
                      {formatNumber(mov.quantity)}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(mov.movement_date)}</td>
                    <td className="py-3 text-gray-500 text-xs">{mov.user_name}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">Sin movimientos registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showTransferModal && (
        <TransferModal
          products={products}
          warehouses={warehouses}
          onClose={() => setShowTransferModal(false)}
          onSaved={() => { setShowTransferModal(false); load(); }}
        />
      )}
    </div>
  );
}

function TransferModal({ products, warehouses, onClose, onSaved }: {
  products: Product[];
  warehouses: (Warehouse & { company: { id: string; name: string } })[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [originWh, setOriginWh] = useState('');
  const [destWh, setDestWh] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (originWh === destWh) {
      setError('La bodega de origen y destino deben ser diferentes');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await registerTransfer(originWh, destWh, productId, quantity, new Date().toISOString().slice(0, 10), observations, 'Administrador');
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
    <Modal open={true} onClose={onClose} title="Nueva Transferencia de Inventario" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Bodega Origen</span>
            <select required value={originWh} onChange={(e) => setOriginWh(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.company.name} — {w.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Bodega Destino</span>
            <select required value={destWh} onChange={(e) => setDestWh(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.company.name} — {w.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Producto</span>
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
            <option value="">Seleccionar...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Cantidad</span>
          <input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Observaciones</span>
          <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className="input" />
        </label>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <ArrowLeftRight size={16} /> {saving ? 'Transferiendo...' : 'Transferir'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
