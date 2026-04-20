import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, BarChart2, Settings2 } from 'lucide-react';
import { Dashboard } from '@/pages/Dashboard';
import { Transactions } from '@/pages/Transactions';
import { Analytics } from '@/pages/Analytics';
import { ControlPanel } from '@/pages/ControlPanel';
import { MonthProvider, useMonth } from '@/contexts/MonthContext';
import { cn, formatMonthYear } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/control-panel', icon: Settings2, label: 'Control Panel' },
];

function Sidebar() {
  const { year, month } = useMonth();
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950 py-6">
      <div className="px-4 mb-6">
        <h1 className="text-sm font-semibold text-white tracking-tight">Personal Finance</h1>
      </div>
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">{formatMonthYear(year, month)}</p>
      </div>
    </aside>
  );
}

export function App() {
  return (
    <MonthProvider>
      <BrowserRouter>
        <div className="flex h-screen bg-zinc-950 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/control-panel" element={<ControlPanel />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </MonthProvider>
  );
}
