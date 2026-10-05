import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/format';
import { Users, Plus } from 'lucide-react';
import type { Customer, Invoice } from '@/types';
import { fetchCustomers, createCustomer, fetchInvoices } from '@/lib/data';

export function CustomersView() {
  const { isGlobal, selectedCompanyId, selectedCompany, companies } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cs, invs] = await Promise.all([
        fetchCustomers(selectedCompanyId || undefined),
        fetchInvoices(selectedCompanyId || undefined),
      ]);
      setCustomers(cs);
      setInvoices(invs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const getCustomerBalance = (customerId: string) =>
    invoices.filter((i) => i.customer_id === customerId).reduce((s, i) => s + Number(i.balance), 0);

  const totalReceivables = invoices.reduce((s, i) => s + Number(i.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Todos los clientes del Grupo JYC' : `Clientes de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && (
          <Button onClick={() => setShowModal(true)}><Plus size={16} /> Nuevo Cliente</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Total Clientes</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{customers.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Cuentas por Cobrar</p>
          <p className="mt-1 text-2xl font-bold text-teal-600">{formatCurrency(totalReceivables)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Facturas Pendientes</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{invoices.filter((i) => i.status === 'pendiente').length}</p>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando clientes...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Nombre</th>
                  <th className="pb-2 pr-4 font-medium">Identificación</th>
                  <th className="pb-2 pr-4 font-medium">Teléfono</th>
                  <th className="pb-2 pr-4 font-medium">Dirección</th>
                  <th className="pb-2 pr-4 font-medium text-right">Límite Crédito</th>
                  <th className="pb-2 font-medium text-right">Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => {
                  const balance = getCustomerBalance(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{c.name}</td>
                      <td className="py-3 pr-4 text-gray-500">{c.identification || '—'}</td>
                      <td className="py-3 pr-4 text-gray-500">{c.phone || '—'}</td>
                      <td className="py-3 pr-4 text-gray-500">{c.address || '—'}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(c.credit_limit)}</td>
                      <td className={`py-3 text-right font-semibold ${balance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {formatCurrency(balance)}
                      </td>
                    </tr>
                  );
                })}
                {customers.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Sin clientes registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && selectedCompanyId && (
        <CustomerModal companyId={selectedCompanyId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

function CustomerModal({ companyId, onClose, onSaved }: { companyId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', identification: '', phone: '', address: '', credit_limit: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCustomer({ ...form, company_id: companyId });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nuevo Cliente">
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
          <span className="mb-1 block text-sm font-medium text-gray-700">Límite de Crédito</span>
          <input type="number" min="0" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} className="input" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}><Users size={16} /> {saving ? 'Guardando...' : 'Crear Cliente'}</Button>
        </div>
      </form>
    </Modal>
  );
}
