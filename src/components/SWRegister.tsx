'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // If no SW is controlling this page yet (first install / bootstrap),
    // listen for when one takes control and reload — this replaces the stale
    // iOS-cached HTML with a fresh fetch, breaking the "dead buttons" cycle.
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
