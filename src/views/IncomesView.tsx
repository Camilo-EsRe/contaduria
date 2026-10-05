import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/format';
import { Banknote, Plus } from 'lucide-react';
import type { Income } from '@/types';
import { fetchIncomes, createIncome } from '@/lib/data';

const CATEGORIES = ['Ventas Contado', 'Servicios', 'Intereses', 'Comisiones', 'Otros Ingresos'];

export function IncomesView() {
  const { isGlobal, selectedCompanyId, selectedCompany } = useApp();
  const [incomes, setIncomes] = useState<(Income & { company: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchIncomes(selectedCompanyId || undefined);
      setIncomes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const total = incomes.reduce((s, i) => s + Number(i.amount), 0);
  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    total: incomes.filter((i) => i.category === cat).reduce((s, i) => s + Number(i.amount), 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingresos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Ingresos consolidados del Grupo JYC' : `Ingresos de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && (
          <Button onClick={() => setShowModal(true)}><Plus size={16} /> Nuevo Ingreso</Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-gray-500">Total Ingresos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(total)}</p>
        </Card>
        <Card title="Por Categoría">
          <div className="space-y-1.5">
            {byCategory.length === 0 ? (
              <p className="text-sm text-gray-400">Sin ingresos registrados</p>
            ) : (
              byCategory.map((c) => (
                <div key={c.category} className="flex justify-between text-sm">
                  <span className="text-gray-600">{c.category}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(c.total)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando ingresos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  {isGlobal && <th className="pb-2 pr-4 font-medium">Empresa</th>}
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 pr-4 font-medium">Categoría</th>
                  <th className="pb-2 pr-4 font-medium">Descripción</th>
                  <th className="pb-2 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {incomes.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{i.number}</td>
                    {isGlobal && <td className="py-3 pr-4 text-gray-700">{i.company?.name}</td>}
                    <td className="py-3 pr-4 text-gray-500">{formatDate(i.income_date)}</td>
                    <td className="py-3 pr-4"><span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{i.category}</span></td>
                    <td className="py-3 pr-4 text-gray-700">{i.description || '—'}</td>
                    <td className="py-3 text-right font-semibold text-emerald-600">{formatCurrency(i.amount)}</td>
                  </tr>
                ))}
                {incomes.length === 0 && (
                  <tr><td colSpan={isGlobal ? 6 : 5} className="py-8 text-center text-gray-400">Sin ingresos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && selectedCompanyId && (
        <IncomeModal companyId={selectedCompanyId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

function IncomeModal({ companyId, onClose, onSaved }: { companyId: string; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { setError('El monto debe ser mayor a 0'); return; }
    setSaving(true);
    setError(null);
    try {
      await createIncome(companyId, new Date().toISOString().slice(0, 10), category, description, amount, 'Administrador');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nuevo Ingreso">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Descripción</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Monto</span>
          <input type="number" min="0" required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}><Banknote size={16} /> {saving ? 'Guardando...' : 'Registrar Ingreso'}</Button>
        </div>
      </form>
    </Modal>
  );
}
