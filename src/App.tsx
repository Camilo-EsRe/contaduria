import { AppProvider, useApp } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { DashboardView } from '@/views/DashboardView';
import { InventoryView } from '@/views/InventoryView';
import { MovementsView } from '@/views/MovementsView';
import { PurchasesView } from '@/views/PurchasesView';
import { SalesView } from '@/views/SalesView';
import { CustomersView } from '@/views/CustomersView';
import { SuppliersView } from '@/views/SuppliersView';
import { ReceivablesView } from '@/views/ReceivablesView';
import { PayablesView } from '@/views/PayablesView';
import { ExpensesView } from '@/views/ExpensesView';
import { IncomesView } from '@/views/IncomesView';
import { TransfersView } from '@/views/TransfersView';
import { SupplyRequestsView } from '@/views/SupplyRequestsView';
import { POSView } from '@/views/POSView';
import { MermasView } from '@/views/MermasView';
import { RecipesView } from '@/views/RecipesView';

function MainContent() {
  const { currentView, loading } = useApp();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-400">Cargando sistema...</div>
      </div>
    );
  }

  switch (currentView) {
    case 'dashboard': return <DashboardView />;
    case 'inventory': return <InventoryView />;
    case 'movements': return <MovementsView />;
    case 'purchases': return <PurchasesView />;
    case 'sales': return <SalesView />;
    case 'customers': return <CustomersView />;
    case 'suppliers': return <SuppliersView />;
    case 'receivables': return <ReceivablesView />;
    case 'payables': return <PayablesView />;
    case 'expenses': return <ExpensesView />;
    case 'incomes': return <IncomesView />;
    case 'transfers': return <TransfersView />;
    case 'supply': return <SupplyRequestsView />;
    case 'pos': return <POSView />;
    case 'mermas': return <MermasView />;
    case 'recipes': return <RecipesView />;
    default: return <DashboardView />;
  }
}

function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex-shrink-0">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <MainContent />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
