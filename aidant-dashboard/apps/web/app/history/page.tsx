'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import type { HistoryItem } from '@/types';

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [date, setDate] = useState('');
  const [gesture, setGesture] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    api.getHistory({ date, gesture, result }).then(setItems);
  }, [date, gesture, result]);

  const gestureOptions = useMemo(() => {
    const source = items ?? [];
    return Array.from(new Set(source.map((item) => item.detectedGesture))).filter(Boolean);
  }, [items]);

  return (
    <DashboardShell>
      <Card className="mb-6">
        <CardHeader title="Filtres" subtitle="Affiner les interactions affichées" />
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <select value={gesture} onChange={(event) => setGesture(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="">Tous les gestes</option>
            {gestureOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={result} onChange={(event) => setResult(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="">Tous les résultats</option>
            <option value="success">Succès</option>
            <option value="failed">Échec</option>
          </select>
        </div>
      </Card>

      {!items ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <Card>
          <CardHeader title="Historique des interactions" />
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-aidant-muted">
            Not available
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Historique des interactions" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-aidant-muted">
                <tr>
                  <th className="py-3 pr-4">Date et heure</th>
                  <th className="py-3 pr-4">Utilisateur</th>
                  <th className="py-3 pr-4">Geste détecté</th>
                  <th className="py-3 pr-4">Mouvement exécuté</th>
                  <th className="py-3 pr-4">Résultat</th>
                  <th className="py-3 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-4 pr-4 font-semibold">{item.dateTime}</td>
                    <td className="py-4 pr-4">{item.user}</td>
                    <td className="py-4 pr-4 font-bold text-aidant-ink">{item.detectedGesture}</td>
                    <td className="py-4 pr-4">{item.executedMovement}</td>
                    <td className="py-4 pr-4"><StatusBadge value={item.result} /></td>
                    <td className="py-4 pr-4 text-aidant-muted">{item.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
