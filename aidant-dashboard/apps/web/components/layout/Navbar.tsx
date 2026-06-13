'use client';

import { Bell, LogOut, Search } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const titles: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/monitoring': 'Surveillance en temps réel',
  '/mappings': 'Gestes et mouvements',
  '/history': 'Historique',
  '/alerts': 'Alertes',
  '/settings': 'Paramètres',
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('aidant_token');
    localStorage.removeItem('aidant_user');
    router.push('/login');
  };

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-aidant-muted">Espace aidant</p>
        <h1 className="text-xl font-extrabold text-aidant-ink">{titles[pathname] ?? 'Aidant'}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-aidant-muted md:flex">
          <Search size={16} />
          <span>Recherche</span>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          <Bell size={18} />
        </button>
        <button
          onClick={logout}
          className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sortir</span>
        </button>
      </div>
    </header>
  );
}
