'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Battery, Bot, Hand, ListChecks, UserRound, Workflow } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types';

const statIcons = [Bot, UserRound, Hand, Workflow, Battery, ListChecks, AlertTriangle];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const loadStats = () => api.getDashboardStats().then(setStats);
    loadStats();
    const timer = window.setInterval(loadStats, 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!stats) {
    return (
      <DashboardShell>
        <LoadingState />
      </DashboardShell>
    );
  }

  const cards = [
    { label: 'Etat du bras', value: <StatusBadge value={stats.armStatus} /> },
    { label: 'Utilisateur suivi', value: stats.currentUser },
    { label: 'Geste detecte', value: stats.lastDetectedGesture },
    { label: 'Dernier mouvement', value: stats.lastExecutedMovement },
    { label: 'Niveau de batterie', value: stats.batteryLevel === null ? 'Not available' : `${stats.batteryLevel}%` },
    { label: 'Gestes sauvegardes', value: stats.savedGestures },
    { label: "Alertes aujourd'hui", value: stats.alertsToday },
  ];

  return (
    <DashboardShell>
      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-aidant-muted">Utilisateur supervise</p>
            <p className="mt-2 text-2xl font-black text-aidant-ink">{stats.supervisedUser.name}</p>
            <p className="mt-1 text-sm font-semibold text-teal-700">
              Role: {stats.supervisedUser.role} - {stats.supervisedUser.status}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-aidant-muted">Dernier geste</p>
            <p className="mt-2 text-xl font-black text-aidant-ink">{stats.lastDetectedGesture}</p>
            <p className="mt-1 text-sm text-aidant-muted">Derniere action: {stats.lastExecutedMovement}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-aidant-muted">Etat du bras</p>
            <div className="mt-2">
              <StatusBadge value={stats.armStatus} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => {
          const Icon = statIcons[index];
          return (
            <Card key={card.label} className="min-h-32">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-aidant-muted">{card.label}</p>
                  <div className="mt-3 text-2xl font-black text-aidant-ink">{card.value}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <Icon size={20} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Derniere activite" subtitle="Evenements reels recus par le backend" />
          {stats.recentActivity.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-aidant-muted">
              Not available
            </p>
          ) : (
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-bold text-aidant-ink">{activity.title}</p>
                      <span className="text-xs font-semibold text-aidant-muted">{activity.time}</span>
                    </div>
                    <p className="mt-1 text-sm text-aidant-muted">{activity.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Resume d'activite" subtitle="Disponible lorsque des historiques persistants existent" />
          {stats.activitySummary.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-aidant-muted">
              Not available
            </p>
          ) : (
            <div className="space-y-3">
              {stats.activitySummary.map((item) => {
                const total = item.success + item.failed;
                const successWidth = total > 0 ? (item.success / total) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                      <span>{item.label}</span>
                      <span>{item.success} success / {item.failed} failed</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-rose-100">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${successWidth}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
