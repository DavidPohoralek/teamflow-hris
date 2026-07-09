'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    // Clean up the _nc cache-busting param from the URL (added by layout.tsx inline script)
    if (window.location.search.includes('_nc=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('_nc');
      history.replaceState(null, '', url.pathname + (url.search || '') + (url.hash || ''));
    }

    if (!('serviceWorker' in navigator)) return;

    // If no SW was controlling this page, reload once it activates so the newly
    // installed SW can serve fresh HTML for all subsequent PWA launches.
    const needsBootstrap = !navigator.serviceWorker.controller;

    navigator.serviceWorker.register('/sw.js').catch(() => {});

    if (needsBootstrap) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => { window.location.reload(); },
        { once: true }
      );
    }
  }, []);

  return null;
}
