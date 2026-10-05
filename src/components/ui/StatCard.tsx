import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'slate';
}

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  teal: 'bg-teal-50 text-teal-600 border-teal-100',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function StatCard({ label, value, icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {trend && <p className="mt-1 text-xs text-gray-400">{trend}</p>}
        </div>
        <div className={`flex-shrink-0 rounded-lg border p-2.5 ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
