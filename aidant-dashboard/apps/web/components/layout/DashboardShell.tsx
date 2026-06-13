'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('aidant_token');
    const rawUser = localStorage.getItem('aidant_user');
    let role: string | null = null;
    try {
      role = rawUser ? JSON.parse(rawUser).role : null;
    } catch {
      role = null;
    }
    if (!token) {
      router.replace('/login');
      return;
    }
    if (role !== 'aidant') {
      localStorage.removeItem('aidant_token');
      localStorage.removeItem('aidant_user');
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-aidant-muted">Vérification...</div>;
  }

  return (
    <div className="flex min-h-screen bg-aidant-surface">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
