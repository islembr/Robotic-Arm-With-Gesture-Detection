import type { ReactNode } from 'react';
import { PwaRegistrar } from '@/components/PwaRegistrar';
import './globals.css';

export const metadata = {
  title: 'Aidant | Tableau de bord',
  description: 'Dashboard de supervision pour bras robotique intelligent controle par gestes.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Aidant',
  appleWebApp: {
    capable: true,
    title: 'Aidant',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
  },
};

export const viewport = {
  themeColor: '#0ea5e9',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}