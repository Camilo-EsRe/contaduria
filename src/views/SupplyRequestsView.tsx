import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatNumber, formatDate } from '@/lib/format';
import {
  PackageSearch,
  Plus,
  Check,
  X,
  Truck,
  PackageCheck,
} from 'lucide-react';
import type { Product, Warehouse, Company, SupplyRequest, SupplyRequestItem } from '@/types';
import {
  fetchProducts,
  fetchWarehouses,
  fetchCompanies,
  fetchSupplyRequests,
  createSupplyRequest,
  approveSupplyRequest,
  rejectSupplyRequest,
  dispatchSupplyRequest,
  receiveSupplyRequest,
} from '@/lib/data';

export function SupplyRequestsView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detailRequest, setDetailRequest] = useState<SupplyRequest | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [reqs, prods, comps] = await Promise.all([
        fetchSupplyRequests(),
        fetchProducts(),
        fetchCompanies(),
      ]);
      setRequests(reqs);
      setProducts(prods);
      setCompanies(comps);
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

  const filtered = isGlobal
    ? requests
    : requests.filter(
        (r) => r.requestor_company_id === selectedCompanyId || r.supplier_company_id === selectedCompanyId
      );

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      solicitada: 'bg-blue-100 text-blue-700',
      aprobada: 'bg-teal-100 text-teal-700',
      despachada: 'bg-amber-100 text-amber-700',
      recibida: 'bg-emerald-100 text-emerald-700',
      rechazada: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      solicitada: 'Solicitada',
      aprobada: 'Aprobada',
      despachada: 'Despachada',
      recibida: 'Recibida',
      rechazada: 'Rechazada',
    };
    return map[status] || status;
  };

  const handleApprove = async (id: string) => {
    try {
      const result = await approveSupplyRequest(id, 'Administrador');
      if (!result.success) { alert(result.error); return; }
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleReject = async (id: string) => {
    try {
      const result = await rejectSupplyRequest(id, 'Administrador');
      if (!result.success) { alert(result.error); return; }
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleDispatch = async (id: string) => {
    try {
      const result = await dispatchSupplyRequest(id, 'Administrador');
      if (!result.success) { alert(result.error); return; }
      load();
    } catch (err: any) { alert(err.message); }
  };

  const handleReceive = async (id: string) => {
    try {
      const result = await receiveSupplyRequest(id, 'Administrador');
      if (!result.success) { alert(result.error); return; }
      load();
    } catch (err: any) { alert(err.message); }
  };

  const getRequestorName = (r: SupplyRequest) => {
    const c = companies.find((c) => c.id === r.requestor_company_id);
    return c?.name || 'N/A';
  };

  const getSupplierName = (r: SupplyRequest) => {
    const c = companies.find((c) => c.id === r.supplier_company_id);
    return c?.name || 'N/A';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Abastecimiento</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Todas las solicitudes entre empresas del grupo' : `Solicitudes de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && selectedCompany && selectedCompany.type === 'punto_venta' && (
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva Solicitud
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando solicitudes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  <th className="pb-2 pr-4 font-medium">Solicitante</th>
                  <th className="pb-2 pr-4 font-medium">Proveedor</th>
                  <th className="pb-2 pr-4 font-medium">Items</th>
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => {
                  const items = (r.items as unknown as SupplyRequestItem[]) || [];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">{r.number}</td>
                      <td className="py-3 pr-4 text-gray-700">{getRequestorName(r)}</td>
                      <td className="py-3 pr-4 text-gray-700">{getSupplierName(r)}</td>
                      <td className="py-3 pr-4">
                        <button onClick={() => setDetailRequest(r)} className="text-teal-600 hover:underline">
                          {items.length} producto(s)
                        </button>
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(r.request_date)}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === 'solicitada' && selectedCompanyId === r.supplier_company_id && (
                            <>
                              <Button size="sm" onClick={() => handleApprove(r.id)}>
                                <Check size={14} /> Aprobar
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleReject(r.id)}>
                                <X size={14} />
                              </Button>
                            </>
                          )}
                          {r.status === 'aprobada' && selectedCompanyId === r.supplier_company_id && (
                            <Button size="sm" variant="secondary" onClick={() => handleDispatch(r.id)}>
                              <Truck size={14} /> Despachar
                            </Button>
                          )}
                          {r.status === 'despachada' && selectedCompanyId === r.requestor_company_id && (
                            <Button size="sm" onClick={() => handleReceive(r.id)}>
                              <PackageCheck size={14} /> Recibir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400">Sin solicitudes de abastecimiento</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && selectedCompanyId && (
        <SupplyRequestModal
          products={products}
          warehouses={warehouses}
          companies={companies}
          requestorCompanyId={selectedCompanyId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {detailRequest && (
        <Modal open={true} onClose={() => setDetailRequest(null)} title={`Detalle Solicitud ${detailRequest.number}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-400">Solicitante</p><p className="font-medium text-gray-900">{getRequestorName(detailRequest)}</p></div>
              <div><p className="text-gray-400">Proveedor</p><p className="font-medium text-gray-900">{getSupplierName(detailRequest)}</p></div>
              <div><p className="text-gray-400">Fecha</p><p className="font-medium text-gray-900">{formatDate(detailRequest.request_date)}</p></div>
              <div><p className="text-gray-400">Estado</p><p className="font-medium text-gray-900">{statusLabel(detailRequest.status)}</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 font-medium text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(detailRequest.items as unknown as SupplyRequestItem[]).map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-gray-900">{item.product_name}</td>
                      <td className="py-2 text-right text-gray-700">{formatNumber(item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detailRequest.notes && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{detailRequest.notes}</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function SupplyRequestModal({ products, warehouses, companies, requestorCompanyId, onClose, onSaved }: {
  products: Product[];
  warehouses: Warehouse[];
  companies: Company[];
  requestorCompanyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supplierCompanyId, setSupplierCompanyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [items, setItems] = useState<SupplyRequestItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierCompanies = companies.filter((c) =>
    c.type === 'matriz' || c.type === 'operativa'
  );

  const addItem = () => {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product || qty < 1) return;
    setItems([...items, { product_id: product.id, product_name: product.name, quantity: qty }]);
    setSelectedProduct('');
    setQty(1);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { setError('Agregue al menos un producto'); return; }
    if (!supplierCompanyId) { setError('Seleccione el proveedor (Finpollo o JYC)'); return; }
    setSaving(true);
    setError(null);
    try {
      await createSupplyRequest(requestorCompanyId, warehouseId, supplierCompanyId, items, notes, 'Administrador');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nueva Solicitud de Abastecimiento" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
          La sucursal solicita productos a Finpollo o JYC. El proveedor aprueba, despacha y la sucursal confirma recepción.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Proveedor (Matriz/Finpollo)</span>
            <select required value={supplierCompanyId} onChange={(e) => setSupplierCompanyId(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {supplierCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Bodega de Recepción</span>
            <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
              <option value="">Seleccionar...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">Agregar Producto</p>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="input">
                <option value="">Seleccionar...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <input type="number" min="1" placeholder="Cant." value={qty} onChange={(e) => setQty(Number(e.target.value))} className="input" />
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
                  <th className="px-3 py-2 font-medium text-right">Cantidad</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Notas</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </label>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <PackageSearch size={16} /> {saving ? 'Enviando...' : 'Enviar Solicitud'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
