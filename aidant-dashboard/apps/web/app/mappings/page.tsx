'use client';

import { useEffect, useState } from 'react';
import { Eye, Power } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import type { GestureMapping } from '@/types';

export default function MappingsPage() {
  const [mappings, setMappings] = useState<GestureMapping[] | null>(null);

  useEffect(() => {
    api.getMappings().then(setMappings);
  }, []);

  if (!mappings) {
    return (
      <DashboardShell>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Card>
        <CardHeader
          title="Configurations gestes et mouvements"
          subtitle="Vue supervision uniquement. La programmation reste dans l application mobile utilisateur."
        />

        {mappings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-base font-black text-aidant-ink">Aucun geste programme</p>
            <p className="mt-2 text-sm text-aidant-muted">
              Les associations geste-mouvement apparaitront ici apres programmation depuis l application mobile.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-aidant-muted">
                <tr>
                  <th className="py-3 pr-4">Geste</th>
                  <th className="py-3 pr-4">Mouvement</th>
                  <th className="py-3 pr-4">Cree le</th>
                  <th className="py-3 pr-4">Derniere utilisation</th>
                  <th className="py-3 pr-4">Statut</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="py-4 pr-4 font-bold text-aidant-ink">{mapping.gestureName}</td>
                    <td className="py-4 pr-4">{mapping.movementName}</td>
                    <td className="py-4 pr-4 text-aidant-muted">{mapping.createdDate}</td>
                    <td className="py-4 pr-4 text-aidant-muted">{mapping.lastUsed}</td>
                    <td className="py-4 pr-4"><StatusBadge value={mapping.status} /></td>
                    <td className="py-4 pr-4">
                      <div className="flex gap-2">
                        <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                          <Eye size={14} /> Details
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
                          <Power size={14} /> {mapping.status === 'enabled' ? 'Desactiver' : 'Activer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
