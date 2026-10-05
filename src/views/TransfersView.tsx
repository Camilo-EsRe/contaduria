import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatNumber, formatDate } from '@/lib/format';
import {
  ArrowLeftRight,
  Plus,
  PackageCheck,
  PackagePlus,
  Clock,
  CheckCircle2,
  PackageSearch,
} from 'lucide-react';
import type { Product, Warehouse, TransferRequest } from '@/types';
import {
  fetchProducts,
  fetchAllWarehousesWithCompany,
  fetchTransferRequests,
  createTransferRequest,
  dispatchTransferRequest,
  receiveTransferRequest,
} from '@/lib/data';

export function TransfersView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  // Note: 'selectedCompany' is used in the subtitle below
  const [requests, setRequests] = useState<(TransferRequest & { product: Product; origin_warehouse: Warehouse & { company: { name: string } }; dest_warehouse: Warehouse & { company: { name: string } } })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<(Warehouse & { company: { id: string; name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [reqs, prods, whs] = await Promise.all([
        fetchTransferRequests(),
        fetchProducts(),
        fetchAllWarehousesWithCompany(),
      ]);
      setRequests(reqs as any);
      setProducts(prods);
      setWarehouses(whs as any);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const filtered = isGlobal
    ? requests
    : requests.filter(
        (r) =>
          r.origin_warehouse?.company?.id === selectedCompanyId ||
          r.dest_warehouse?.company?.id === selectedCompanyId
      );

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      solicitada: 'bg-blue-100 text-blue-700',
      en_transito: 'bg-amber-100 text-amber-700',
      recibida: 'bg-emerald-100 text-emerald-700',
      anulada: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      solicitada: 'Solicitada',
      en_transito: 'En Tránsito',
      recibida: 'Recibida',
      anulada: 'Anulada',
    };
    return map[status] || status;
  };

  const handleDispatch = async (id: string) => {
    try {
      const result = await dispatchTransferRequest(id, 'Administrador');
      if (!result.success) { alert(result.error); return; }
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReceive = async (id: string) => {
    try {
      const result = await receiveTransferRequest(id, 'Administrador');
      if (!result.success) { alert(result.error); return; }
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traslados con Protocolo Handshake</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sistema de dos pasos: Despacho (origen resta stock) → Recepción (destino suma stock)
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nueva Solicitud de Traslado
        </Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-600"><Clock size={18} /></div>
          <p className="mt-1 text-xs font-medium text-blue-600">Solicitadas</p>
          <p className="text-xl font-bold text-blue-700">{filtered.filter((r) => r.status === 'solicitada').length}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-600"><PackagePlus size={18} /></div>
          <p className="mt-1 text-xs font-medium text-amber-600">En Tránsito</p>
          <p className="text-xl font-bold text-amber-700">{filtered.filter((r) => r.status === 'en_transito').length}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 size={18} /></div>
          <p className="mt-1 text-xs font-medium text-emerald-600">Recibidas</p>
          <p className="text-xl font-bold text-emerald-700">{filtered.filter((r) => r.status === 'recibida').length}</p>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando traslados...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  <th className="pb-2 pr-4 font-medium">Producto</th>
                  <th className="pb-2 pr-4 font-medium">Ruta</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cantidad</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 pr-4 font-medium">Despacho</th>
                  <th className="pb-2 pr-4 font-medium">Recepción</th>
                  <th className="pb-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{r.number}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{r.product?.name}</td>
                    <td className="py-3 pr-4 text-xs text-gray-500">
                      <div>{r.origin_warehouse?.company?.name}</div>
                      <div className="text-gray-400">{r.origin_warehouse?.name} → {r.dest_warehouse?.name}</div>
                      <div className="text-gray-400">{r.dest_warehouse?.company?.name}</div>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900">{formatNumber(r.quantity)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {r.dispatch_date ? formatDate(r.dispatch_date) : '—'}
                      {r.dispatched_by && <div className="text-gray-400">{r.dispatched_by}</div>}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {r.reception_date ? formatDate(r.reception_date) : '—'}
                      {r.received_by && <div className="text-gray-400">{r.received_by}</div>}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {r.status === 'solicitada' && (
                          <Button size="sm" variant="secondary" onClick={() => handleDispatch(r.id)}>
                            <PackagePlus size={14} /> Despachar
                          </Button>
                        )}
                        {r.status === 'en_transito' && (
                          <Button size="sm" onClick={() => handleReceive(r.id)}>
                            <PackageCheck size={14} /> Recibir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400">Sin solicitudes de traslado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && (
        <TransferRequestModal
          products={products}
          warehouses={warehouses}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function TransferRequestModal({ products, warehouses, onClose, onSaved }: {
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
    if (originWh === destWh) { setError('La bodega de origen y destino deben ser diferentes'); return; }
    setSaving(true);
    setError(null);
    try {
      await createTransferRequest(originWh, destWh, productId, quantity, observations, 'Administrador');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nueva Solicitud de Traslado (Handshake)" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          El traslado se realiza en dos pasos: primero se despacha (resta stock del origen), luego se recibe (suma stock al destino). El inventario global no se altera.
        </div>
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
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <ArrowLeftRight size={16} /> {saving ? 'Creando...' : 'Crear Solicitud'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
