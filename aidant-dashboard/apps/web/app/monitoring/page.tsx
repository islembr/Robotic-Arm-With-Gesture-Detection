'use client';

import { useEffect, useState } from 'react';
import { Radio, RefreshCcw } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import type { MonitoringLive } from '@/types';

export default function MonitoringPage() {
  const [live, setLive] = useState<MonitoringLive | null>(null);

  useEffect(() => {
    const loadLiveData = () => api.getMonitoringLive().then(setLive);
    loadLiveData();
    const timer = window.setInterval(loadLiveData, 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!live) {
    return (
      <DashboardShell>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Surveillance en temps reel" subtitle="Donnees recues du backend et du flux MQTT lorsqu'elles existent" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Geste detecte" value={live.detectedGesture} />
              <Info label="Mouvement associe" value={live.associatedMovement} />
              <Info label="Etat du bras" value={live.armState} />
              <div>
                <p className="text-sm font-semibold text-aidant-muted">Connexion</p>
                <div className="mt-2"><StatusBadge value={live.connectionStatus} /></div>
              </div>
              <Info label="Derniere mise a jour" value={new Date(live.lastUpdate).toLocaleTimeString('fr-FR')} />
              <Info label="Confiance detection" value={live.confidence > 0 ? `${Math.round(live.confidence * 100)}%` : 'Not available'} />
            </div>
          </Card>
        </div>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardHeader title="Flux d'activite" />
            <RefreshCcw size={18} className="text-sky-600" />
          </div>
          {live.feed.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-aidant-muted">
              Not available
            </p>
          ) : (
            <div className="space-y-4">
              {live.feed.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-teal-600" />
                    <p className="text-sm font-bold text-aidant-ink">{item.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-aidant-muted">{item.time} - {item.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-aidant-muted">{label}</p>
      <p className="mt-2 text-lg font-black text-aidant-ink">{value}</p>
    </div>
  );
}
