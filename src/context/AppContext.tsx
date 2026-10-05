import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Company } from '@/types';
import { fetchCompanies } from '@/lib/data';

export type ViewKey =
  | 'dashboard'
  | 'inventory'
  | 'movements'
  | 'transfers'
  | 'purchases'
  | 'sales'
  | 'customers'
  | 'suppliers'
  | 'receivables'
  | 'payables'
  | 'expenses'
  | 'incomes'
  | 'supply'
  | 'pos'
  | 'mermas'
  | 'recipes';

interface AppContextValue {
  companies: Company[];
  loading: boolean;
  selectedCompanyId: string | null; // null = consolidated/global
  selectedCompany: Company | null;
  setSelectedCompanyId: (id: string | null) => void;
  currentView: ViewKey;
  setCurrentView: (v: ViewKey) => void;
  // Which views are available given the current selection
  isGlobal: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewKey>('dashboard');

  useEffect(() => {
    fetchCompanies()
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching companies:', err);
        setLoading(false);
      });
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const isGlobal = selectedCompanyId === null;

  const value: AppContextValue = {
    companies,
    loading,
    selectedCompanyId,
    selectedCompany,
    setSelectedCompanyId,
    currentView,
    setCurrentView,
    isGlobal,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
