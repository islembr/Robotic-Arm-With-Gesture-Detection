import { clsx } from 'clsx';
import type { AlertSeverity, AlertStatus, ConnectionState, InteractionResult, MappingStatus } from '@/types';

type BadgeValue = ConnectionState | MappingStatus | InteractionResult | AlertSeverity | AlertStatus | string;

const badgeClass: Record<string, string> = {
  connected: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  disconnected: 'bg-rose-50 text-rose-700 ring-rose-200',
  degraded: 'bg-amber-50 text-amber-700 ring-amber-200',
  enabled: 'bg-sky-50 text-sky-700 ring-sky-200',
  disabled: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
  low: 'bg-sky-50 text-sky-700 ring-sky-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  new: 'bg-blue-50 text-blue-700 ring-blue-200',
  resolved: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const labels: Record<string, string> = {
  connected: 'Connecté',
  disconnected: 'Déconnecté',
  degraded: 'Dégradé',
  enabled: 'Activé',
  disabled: 'Désactivé',
  success: 'Succès',
  failed: 'Échec',
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  new: 'Nouvelle',
  resolved: 'Résolue',
};

export function StatusBadge({ value }: { value: BadgeValue }) {
  const key = String(value);
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        badgeClass[key] ?? 'bg-slate-100 text-slate-700 ring-slate-200',
      )}
    >
      {labels[key] ?? key}
    </span>
  );
}
