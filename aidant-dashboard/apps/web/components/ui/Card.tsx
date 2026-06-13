import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <section className={clsx('rounded-lg border border-slate-200 bg-white p-5 shadow-soft', className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-aidant-ink">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-aidant-muted">{subtitle}</p> : null}
    </div>
  );
}
