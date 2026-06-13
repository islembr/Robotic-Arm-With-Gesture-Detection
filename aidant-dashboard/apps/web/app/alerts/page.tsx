'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import type { AlertItem } from '@/types';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);

  useEffect(() => {
    const loadAlerts = () => api.getAlerts().then(setAlerts);
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const resolve = async (id: string) => {
    const updated = await api.resolveAlert(id);
    setAlerts((current) => current?.map((alert) => (alert.id === id ? updated : alert)) ?? null);
  };

  if (!alerts) {
    return (
      <DashboardShell>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {alerts.length === 0 ? (
        <Card>
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-aidant-muted">
            Not available
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => (
          <Card key={alert.id}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-aidant-ink">{alert.title}</h2>
                <p className="mt-1 text-sm text-aidant-muted">{alert.dateTime}</p>
              </div>
              <StatusBadge value={alert.severity} />
            </div>
            <p className="min-h-14 text-sm leading-6 text-slate-600">{alert.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <StatusBadge value={alert.status} />
              <button
                disabled={alert.status === 'resolved'}
                onClick={() => resolve(alert.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <CheckCircle2 size={16} />
                Résoudre
              </button>
            </div>
          </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
