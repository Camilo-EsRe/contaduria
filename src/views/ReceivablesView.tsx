import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/format';
import { FileText, DollarSign, AlertCircle } from 'lucide-react';
import type { Invoice } from '@/types';
import { fetchInvoices, registerCustomerPayment } from '@/lib/data';

export function ReceivablesView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [invoices, setInvoices] = useState<(Invoice & { company: { name: string }; customer: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices(selectedCompanyId || undefined);
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const today = new Date().toISOString().slice(0, 10);
  const totalReceivables = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const totalOverdue = invoices
    .filter((i) => i.status === 'pendiente' && i.due_date && i.due_date < today)
    .reduce((s, i) => s + Number(i.balance), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cuentas por Cobrar</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isGlobal ? 'Cartera consolidada del Grupo JYC' : `Cartera de ${selectedCompany?.name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Total por Cobrar</p>
          <p className="mt-1 text-2xl font-bold text-teal-600">{formatCurrency(totalReceivables)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Cartera Vencida</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Facturas Pendientes</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{invoices.filter((i) => i.status === 'pendiente').length}</p>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando cartera...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  {isGlobal && <th className="pb-2 pr-4 font-medium">Empresa</th>}
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Vencimiento</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium text-right">Pagado</th>
                  <th className="pb-2 pr-4 font-medium text-right">Saldo</th>
                  <th className="pb-2 pr-4 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => {
                  const isOverdue = inv.status === 'pendiente' && inv.due_date && inv.due_date < today;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">{inv.number}</td>
                      {isGlobal && <td className="py-3 pr-4 text-gray-700">{inv.company?.name}</td>}
                      <td className="py-3 pr-4 font-medium text-gray-900">{inv.customer?.name}</td>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(inv.invoice_date)}</td>
                      <td className="py-3 pr-4 text-gray-500">
                        {inv.due_date ? formatDate(inv.due_date) : '—'}
                        {isOverdue && <AlertCircle size={14} className="inline ml-1 text-red-500" />}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(inv.total)}</td>
                      <td className="py-3 pr-4 text-right text-emerald-600">{formatCurrency(inv.paid_amount)}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-gray-900">{formatCurrency(inv.balance)}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          inv.status === 'pagada' ? 'bg-emerald-100 text-emerald-700' :
                          isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isOverdue ? 'vencida' : inv.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {inv.balance > 0 && (
                          <Button size="sm" variant="primary" onClick={() => setPaymentInvoice(inv)}>
                            <DollarSign size={14} /> Pagar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr><td colSpan={isGlobal ? 10 : 9} className="py-8 text-center text-gray-400">Sin facturas por cobrar</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {paymentInvoice && (
        <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onSaved={() => { setPaymentInvoice(null); load(); }} />
      )}
    </div>
  );
}

function PaymentModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(invoice.balance);
  const [method, setMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { setError('El monto debe ser mayor a 0'); return; }
    if (amount > invoice.balance) { setError('El monto excede el saldo pendiente'); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await registerCustomerPayment(invoice.id, amount, new Date().toISOString().slice(0, 10), method, 'Administrador');
      if (!result.success) { setError(result.error); return; }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Registrar Pago — ${invoice.number}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Cliente:</span><span className="font-medium">{(invoice as any).customer?.name || 'N/A'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total:</span><span className="font-medium">{formatCurrency(invoice.total)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Pagado:</span><span className="font-medium text-emerald-600">{formatCurrency(invoice.paid_amount)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Saldo:</span><span className="font-bold text-gray-900">{formatCurrency(invoice.balance)}</span></div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Monto del Pago</span>
          <input type="number" min="0" max={invoice.balance} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Método de Pago</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cheque">Cheque</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}><DollarSign size={16} /> {saving ? 'Procesando...' : 'Registrar Pago'}</Button>
        </div>
      </form>
    </Modal>
  );
}
