'use client';

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {
        // PWA support is progressive; the dashboard remains usable if registration fails.
      }
    };

    register();
  }, []);

  return null;
}
