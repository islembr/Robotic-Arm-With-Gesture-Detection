'use client';

import { useEffect, useState } from 'react';
import { Moon, PlugZap, UserRound } from 'lucide-react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { api } from '@/lib/api';
import type { ProfileSettings } from '@/types';

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [darkPreview, setDarkPreview] = useState(false);

  useEffect(() => {
    api.getProfile().then(setProfile);
  }, []);

  if (!profile) {
    return (
      <DashboardShell>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profil" subtitle="Informations de l’aidant" />
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <UserRound size={26} />
            </div>
            <div>
              <p className="text-lg font-black text-aidant-ink">{profile.aidantName}</p>
              <p className="text-sm text-aidant-muted">{profile.email}</p>
              <p className="mt-1 text-sm font-semibold text-teal-700">Utilisateur suivi: {profile.followedUser}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Préférences de notification" />
          <div className="space-y-3">
            <Toggle label="Notifications email" checked={profile.notifications.email} />
            <Toggle label="Alertes critiques" checked={profile.notifications.criticalAlerts} />
            <Toggle label="Résumé quotidien" checked={profile.notifications.dailySummary} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Connexion système" subtitle="Emplacement réservé pour paramètres IoT réels" />
          <div className="space-y-3 text-sm">
            <Info label="Broker" value={profile.connection.broker} />
            <Info label="Device ID" value={profile.connection.deviceId} />
            <Info label="Dernière synchronisation" value={profile.connection.lastSync} />
          </div>
          <div className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
            <PlugZap className="mr-2 inline" size={16} />
            Intégration future: flux MQTT shiftr, ESP32, batterie et alertes capteurs.
          </div>
        </Card>

        <Card>
          <CardHeader title="Thème" />
          <button
            onClick={() => setDarkPreview((value) => !value)}
            className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700"
          >
            <Moon size={17} />
            {darkPreview ? 'Aperçu sombre activé' : 'Aperçu sombre désactivé'}
          </button>
          <div className={darkPreview ? 'mt-4 rounded-lg bg-slate-900 p-4 text-white' : 'mt-4 rounded-lg bg-slate-100 p-4 text-slate-700'}>
            Prévisualisation locale uniquement pour cette version.
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Toggle({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
      <span className="text-sm font-semibold text-aidant-ink">{label}</span>
      <span className={checked ? 'h-6 w-11 rounded-full bg-teal-500 p-1' : 'h-6 w-11 rounded-full bg-slate-300 p-1'}>
        <span className={checked ? 'block h-4 w-4 translate-x-5 rounded-full bg-white' : 'block h-4 w-4 rounded-full bg-white'} />
      </span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="font-semibold text-aidant-muted">{label}</span>
      <span className="font-bold text-aidant-ink">{value}</span>
    </div>
  );
}
