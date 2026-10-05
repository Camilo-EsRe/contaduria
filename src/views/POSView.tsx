import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Calculator,
  Lock,
  Unlock,
  Plus,
  Minus,
  Wallet,
  TrendingUp,
  Receipt,
} from 'lucide-react';
import type { CashRegister, CashMovement, Warehouse } from '@/types';
import {
  fetchCashRegisters,
  fetchCashMovements,
  fetchWarehouses,
  openCashRegister,
  closeCashRegister,
  createCashMovement,
} from '@/lib/data';

const CASH_CATEGORIES = ['Caja Menor', 'Transporte', 'Papelería', 'Servicios', 'Otros'];
const INCOME_CATEGORIES = ['Ventas Extras', 'Propinas', 'Devoluciones', 'Otros'];

export function POSView() {
  const { selectedCompanyId, selectedCompany, isGlobal } = useApp();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState<CashRegister | null>(null);
  const [movementsModal, setMovementsModal] = useState<CashRegister | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [regs, whs] = await Promise.all([
        fetchCashRegisters(selectedCompanyId || undefined),
        fetchWarehouses(selectedCompanyId || undefined),
      ]);
      setRegisters(regs);
      setWarehouses(whs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const activeRegister = registers.find((r) => r.status === 'abierta');
  const closedRegisters = registers.filter((r) => r.status === 'cerrada');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja Diaria / POS</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isGlobal ? 'Cajas de todos los puntos de venta' : `Caja de ${selectedCompany?.name}`}
          </p>
        </div>
        {!isGlobal && !activeRegister && selectedCompanyId && (
          <Button onClick={() => setOpenModal(true)}>
            <Unlock size={16} /> Abrir Caja
          </Button>
        )}
      </div>

      {/* Active register */}
      {activeRegister && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse"></span>
                <p className="text-sm font-semibold text-teal-700">CAJA ABIERTA</p>
              </div>
              <p className="mt-1 text-lg font-bold text-teal-900">{activeRegister.number}</p>
              <p className="text-sm text-teal-600">Abierta el {formatDate(activeRegister.opening_date)} por {activeRegister.opened_by}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-teal-600">Monto de Apertura</p>
              <p className="text-2xl font-bold text-teal-900">{formatCurrency(activeRegister.opening_amount)}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setMovementsModal(activeRegister)}>
              <Wallet size={14} /> Movimientos de Caja
            </Button>
            <Button size="sm" onClick={() => setCloseModal(activeRegister)}>
              <Lock size={14} /> Cerrar Caja (Cuadre)
            </Button>
          </div>
        </div>
      )}

      {/* Closed registers history */}
      <Card title="Historial de Cierres de Caja">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Cargando historial...</div>
        ) : closedRegisters.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-400">Sin cierres de caja registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Número</th>
                  <th className="pb-2 pr-4 font-medium">Apertura</th>
                  <th className="pb-2 pr-4 font-medium">Cierre</th>
                  <th className="pb-2 pr-4 font-medium text-right">Apertura</th>
                  <th className="pb-2 pr-4 font-medium text-right">Ventas Efectivo</th>
                  <th className="pb-2 pr-4 font-medium text-right">Egresos</th>
                  <th className="pb-2 pr-4 font-medium text-right">Esperado</th>
                  <th className="pb-2 pr-4 font-medium text-right">Contado</th>
                  <th className="pb-2 font-medium text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {closedRegisters.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{r.number}</td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(r.opening_date)}</td>
                    <td className="py-3 pr-4 text-gray-500">{r.closing_date ? formatDate(r.closing_date) : '—'}</td>
                    <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(r.opening_amount)}</td>
                    <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(r.sales_cash)}</td>
                    <td className="py-3 pr-4 text-right text-amber-600">{formatCurrency(r.expenses_amount)}</td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-900">{formatCurrency(r.expected_total)}</td>
                    <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(r.counted_total)}</td>
                    <td className={`py-3 text-right font-semibold ${r.difference < 0 ? 'text-red-600' : r.difference > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {formatCurrency(r.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {openModal && selectedCompanyId && (
        <OpenCashModal
          warehouses={warehouses}
          companyId={selectedCompanyId}
          onClose={() => setOpenModal(false)}
          onSaved={() => { setOpenModal(false); load(); }}
        />
      )}

      {closeModal && (
        <CloseCashModal
          register={closeModal}
          onClose={() => setCloseModal(null)}
          onSaved={() => { setCloseModal(null); load(); }}
        />
      )}

      {movementsModal && (
        <CashMovementsModal
          register={movementsModal}
          onClose={() => setMovementsModal(null)}
          onSaved={() => { setMovementsModal(null); load(); }}
        />
      )}
    </div>
  );
}

function OpenCashModal({ warehouses, companyId, onClose, onSaved }: {
  warehouses: Warehouse[];
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [openingAmount, setOpeningAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await openCashRegister(companyId, warehouseId, openingAmount, 'Administrador');
      if (!result.success) { setError(result.error); return; }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Abrir Caja">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Bodega / Punto de Venta</span>
          <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Monto de Apertura (Fondo Inicial)</span>
          <input type="number" min="0" required value={openingAmount} onChange={(e) => setOpeningAmount(Number(e.target.value))} className="input" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            <Unlock size={16} /> {saving ? 'Abriendo...' : 'Abrir Caja'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CloseCashModal({ register, onClose, onSaved }: {
  register: CashRegister;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [countedTotal, setCountedTotal] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await closeCashRegister(register.id, countedTotal, 'Administrador', notes);
      if (!res.success) { setError(res.error); return; }
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Cuadre de Caja — ${register.number}`}>
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 p-4 text-center">
            <Calculator size={32} className="mx-auto text-emerald-600" />
            <p className="mt-2 text-sm text-emerald-600">Caja cerrada correctamente</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-gray-400">Total Esperado</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(result.expected_total)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-gray-400">Total Contado</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(result.counted_total)}</p>
            </div>
            <div className={`col-span-2 rounded-lg p-3 ${result.difference < 0 ? 'bg-red-50' : result.difference > 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <p className={result.difference < 0 ? 'text-red-400' : result.difference > 0 ? 'text-emerald-400' : 'text-gray-400'}>Diferencia</p>
              <p className={`text-2xl font-bold ${result.difference < 0 ? 'text-red-600' : result.difference > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                {formatCurrency(result.difference)}
              </p>
            </div>
          </div>
          <Button onClick={onSaved} className="w-full">Aceptar</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Monto de Apertura:</span><span className="font-medium">{formatCurrency(register.opening_amount)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-500">Caja:</span><span className="font-medium">{register.number}</span></div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Efectivo Contado (Cuadre)</span>
            <input type="number" min="0" required value={countedTotal} onChange={(e) => setCountedTotal(Number(e.target.value))} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Notas del Cierre</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              <Lock size={16} /> {saving ? 'Cerrando...' : 'Cerrar Caja'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function CashMovementsModal({ register, onClose, onSaved }: {
  register: CashRegister;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await fetchCashMovements(register.id);
      setMovements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalIngresos = movements.filter((m) => m.type === 'ingreso').reduce((s, m) => s + Number(m.amount), 0);
  const totalEgresos = movements.filter((m) => m.type === 'egreso').reduce((s, m) => s + Number(m.amount), 0);

  return (
    <Modal open={true} onClose={onClose} title={`Movimientos de Caja — ${register.number}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600">Total Ingresos</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalIngresos)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-600">Total Egresos (Caja Menor)</p>
            <p className="text-lg font-bold text-amber-700">{formatCurrency(totalEgresos)}</p>
          </div>
        </div>

        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={14} /> Registrar Movimiento
        </Button>

        {loading ? (
          <p className="text-center py-4 text-gray-400">Cargando...</p>
        ) : movements.length === 0 ? (
          <p className="text-center py-4 text-sm text-gray-400">Sin movimientos de caja</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 pr-4 font-medium">Categoría</th>
                  <th className="pb-2 pr-4 font-medium">Descripción</th>
                  <th className="pb-2 pr-4 font-medium">Fecha</th>
                  <th className="pb-2 font-medium text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${m.type === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{m.category}</td>
                    <td className="py-2 pr-4 text-gray-500">{m.description || '—'}</td>
                    <td className="py-2 pr-4 text-gray-500">{formatDate(m.movement_date)}</td>
                    <td className={`py-2 text-right font-semibold ${m.type === 'ingreso' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatCurrency(m.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAddModal && (
          <AddCashMovementModal
            register={register}
            onClose={() => setShowAddModal(false)}
            onSaved={() => { setShowAddModal(false); load(); }}
          />
        )}
      </div>
    </Modal>
  );
}

function AddCashMovementModal({ register, onClose, onSaved }: {
  register: CashRegister;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<'ingreso' | 'egreso'>('egreso');
  const [category, setCategory] = useState(CASH_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = type === 'ingreso' ? INCOME_CATEGORIES : CASH_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { setError('El monto debe ser mayor a 0'); return; }
    setSaving(true);
    setError(null);
    try {
      await createCashMovement(register.id, register.company_id, type, category, description, amount, 'Administrador');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Registrar Movimiento de Caja">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => { setType('egreso'); setCategory(CASH_CATEGORIES[0]); }}
            className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium ${type === 'egreso' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500'}`}>
            <Minus size={16} className="mx-auto mb-1" /> Egreso (Caja Menor)
          </button>
          <button type="button" onClick={() => { setType('ingreso'); setCategory(INCOME_CATEGORIES[0]); }}
            className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium ${type === 'ingreso' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
            <Plus size={16} className="mx-auto mb-1" /> Ingreso Extra
          </button>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Categoría</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
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
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
