import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import { Truck, Plus } from 'lucide-react';
import type { Supplier, PayableInvoice } from '@/types';
import { fetchSuppliers, createSupplier, fetchPayableInvoices } from '@/lib/data';

export function SuppliersView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payables, setPayables] = useState<PayableInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ss, ps] = await Promise.all([
        fetchSuppliers(selectedCompanyId || undefined),
        fetchPayableInvoices(selectedCompanyId || undefined),
      ]);
      setSuppliers(ss);
      setPayables(ps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const getSupplierBalance = (supplierId: string) =>
    payables.filter((p) => p.supplier_id === supplierId).reduce((s, p) => s + Number(p.balance), 0);

  const totalPayables = payables.reduce((s, p) => s + Number(p.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Todos los proveedores del Grupo JYC' : `Proveedores de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && (
          <Button onClick={() => setShowModal(true)}><Plus size={16} /> Nuevo Proveedor</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Total Proveedores</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{suppliers.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Cuentas por Pagar</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totalPayables)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Facturas Pendientes</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{payables.filter((p) => p.status === 'pendiente').length}</p>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando proveedores...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Identificación</th>
                  <th className="pb-2 pr-4 font-medium">Teléfono</th>
                  <th className="pb-2 pr-4 font-medium">Contacto</th>
                  <th className="pb-2 font-medium text-right">Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suppliers.map((s) => {
                  const balance = getSupplierBalance(s.id);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{s.name}</td>
                      <td className="py-3 pr-4 text-gray-500">{s.identification || '—'}</td>
                      <td className="py-3 pr-4 text-gray-500">{s.phone || '—'}</td>
                      <td className="py-3 pr-4 text-gray-500">{s.contact_name || '—'}</td>
                      <td className={`py-3 text-right font-semibold ${balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatCurrency(balance)}
                      </td>
                    </tr>
                  );
                })}
                {suppliers.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">Sin proveedores registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && selectedCompanyId && (
        <SupplierModal companyId={selectedCompanyId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

function SupplierModal({ companyId, onClose, onSaved }: { companyId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', identification: '', phone: '', address: '', contact_name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createSupplier({ ...form, company_id: companyId });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nuevo Proveedor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Nombre</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Identificación</span>
            <input value={form.identification} onChange={(e) => setForm({ ...form, identification: e.target.value })} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Teléfono</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Dirección</span>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Nombre del Contacto</span>
          <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="input" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}><Truck size={16} /> {saving ? 'Guardando...' : 'Crear Proveedor'}</Button>
        </div>
      </form>
    </Modal>
  );
}
