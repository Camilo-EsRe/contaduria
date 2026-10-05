import { useApp, type ViewKey } from '@/context/AppContext';
import type { Company } from '@/types';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  TrendingUp,
  Users,
  Truck,
  FileText,
  Receipt,
  Wallet,
  Banknote,
  Building2,
  Layers,
  PackageSearch,
  Calculator,
  Trash2,
  ChefHat,
  Send,
} from 'lucide-react';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
  showForGlobal?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, showForGlobal: true },
  { key: 'inventory', label: 'Inventario', icon: Package, showForGlobal: true },
  { key: 'movements', label: 'Movimientos', icon: ArrowLeftRight, showForGlobal: true },
  { key: 'transfers', label: 'Traslados (Handshake)', icon: Send, showForGlobal: true },
  { key: 'purchases', label: 'Compras', icon: ShoppingCart, showForGlobal: true },
  { key: 'sales', label: 'Ventas', icon: TrendingUp, showForGlobal: true },
  { key: 'customers', label: 'Clientes', icon: Users },
  { key: 'suppliers', label: 'Proveedores', icon: Truck },
  { key: 'receivables', label: 'Cuentas por Cobrar', icon: FileText, showForGlobal: true },
  { key: 'payables', label: 'Cuentas por Pagar', icon: Receipt, showForGlobal: true },
  { key: 'expenses', label: 'Gastos / Egresos', icon: Wallet },
  { key: 'incomes', label: 'Ingresos', icon: Banknote },
  { key: 'supply', label: 'Solicitudes Abastecimiento', icon: PackageSearch, showForGlobal: true },
  { key: 'pos', label: 'Caja Diaria / POS', icon: Calculator },
  { key: 'mermas', label: 'Mermas', icon: Trash2, showForGlobal: true },
  { key: 'recipes', label: 'Recetas / Producción', icon: ChefHat },
];

function CompanyTree({ companies, onSelect, selectedId, depth = 0 }: {
  companies: Company[];
  onSelect: (id: string | null) => void;
  selectedId: string | null;
  depth?: number;
}) {
  const root = companies.filter((c) => !c.parent_id);
  const children = (parentId: string) => companies.filter((c) => c.parent_id === parentId);

  function renderCompany(company: Company, level: number): React.ReactNode {
    const kids = children(company.id);
    const isSelected = selectedId === company.id;
    return (
      <div key={company.id}>
        <button
          onClick={() => onSelect(company.id)}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
            isSelected
              ? 'bg-teal-100 text-teal-800 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
        >
          {company.type === 'matriz' ? (
            <Building2 size={14} className="flex-shrink-0" />
          ) : company.type === 'operativa' ? (
            <Layers size={14} className="flex-shrink-0" />
          ) : (
            <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full bg-gray-300" />
          )}
          <span className="truncate">{company.name}</span>
        </button>
        {kids.length > 0 && (
          <div>{kids.map((k) => renderCompany(k, level + 1))}</div>
        )}
      </div>
    );
  }

  return <div>{root.map((r) => renderCompany(r, depth))}</div>;
}

export function Sidebar() {
  const { companies, selectedCompanyId, setSelectedCompanyId, currentView, setCurrentView, isGlobal, loading } = useApp();

  const visibleItems = navItems.filter((item) => {
    if (isGlobal && !item.showForGlobal) return false;
    return true;
  });

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-sm">
          JYC
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Grupo JYC</p>
          <p className="text-xs text-gray-400">Sistema Contable</p>
        </div>
      </div>

      {/* Company selector */}
      <div className="border-b border-gray-200 px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Empresa</p>
        </div>
        <button
          onClick={() => setSelectedCompanyId(null)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
            isGlobal
              ? 'bg-teal-600 text-white font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Building2 size={14} className="flex-shrink-0" />
          <span>Vista Consolidada</span>
        </button>
        {!loading && (
          <CompanyTree
            companies={companies}
            onSelect={setSelectedCompanyId}
            selectedId={selectedCompanyId}
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Módulos</p>
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-5 py-3">
        <p className="text-xs text-gray-400">© 2026 Grupo JYC</p>
      </div>
    </div>
  );
}
