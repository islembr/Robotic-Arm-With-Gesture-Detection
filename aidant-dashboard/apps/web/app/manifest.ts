import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aidant - Supervision du bras intelligent',
    short_name: 'Aidant',
    description: 'Dashboard de supervision pour bras robotique intelligent controle par gestes.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    background_color: '#f7fafc',
    theme_color: '#0ea5e9',
    orientation: 'portrait-primary',
    categories: ['productivity', 'health', 'education'],
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
