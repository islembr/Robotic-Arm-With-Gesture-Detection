'use client';

import { clsx } from 'clsx';
import {
  Activity,
  AlertTriangle,
  Gauge,
  History,
  LayoutDashboard,
  Settings,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/monitoring', label: 'Surveillance en temps réel', icon: Activity },
  { href: '/mappings', label: 'Gestes et mouvements', icon: Workflow },
  { href: '/history', label: 'Historique', icon: History },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle },
  { href: '/settings', label: 'Paramètres', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
          <Gauge size={22} />
        </div>
        <div>
          <p className="text-lg font-extrabold text-aidant-ink">Aidant</p>
          <p className="text-xs font-medium text-aidant-muted">Supervision robotique</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-aidant-ink',
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
