'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('aidant@demo.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.login(email, password);
      if (response.user.role !== 'aidant') {
        throw new Error('Only aidant accounts can access this dashboard');
      }
      localStorage.setItem('aidant_token', response.token);
      localStorage.setItem('aidant_user', JSON.stringify(response.user));
      router.push('/dashboard');
    } catch {
      localStorage.removeItem('aidant_token');
      localStorage.removeItem('aidant_user');
      setError('Connexion impossible. Utilisez le compte demo autorise.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-aidant-surface lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-aidant-ink">Aidant</h1>
              <p className="text-sm text-aidant-muted">Accès supervision</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Adresse email</span>
              <span className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-sky-400">
                <Mail size={18} className="text-slate-400" />
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  placeholder="aidant@demo.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Mot de passe</span>
              <span className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-sky-400">
                <Lock size={18} className="text-slate-400" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="w-full border-0 bg-transparent text-sm outline-none"
                  placeholder="Mot de passe"
                />
              </span>
            </label>

            {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-sky-600 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </section>

      <section className="hidden items-center justify-center bg-slate-900 px-10 text-white lg:flex">
        <div className="max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-sky-300">Projet bras intelligent</p>
          <h2 className="text-4xl font-black leading-tight">Superviser sans reprendre le contrôle.</h2>
          <p className="mt-5 text-base leading-7 text-slate-300">
            Le tableau de bord Aidant suit l’état du bras robotique, les gestes reconnus,
            les mouvements exécutés et les alertes critiques.
          </p>
        </div>
      </section>
    </main>
  );
}
