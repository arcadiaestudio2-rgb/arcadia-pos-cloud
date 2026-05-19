import { useState, useEffect } from 'react';

let globalDeferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  globalDeferredPrompt = e;
});

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstallable, setIsInstallable] = useState(!!globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                               (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('✅ [PWA] Evento beforeinstallprompt capturado. Listo para instalar.');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      console.log('🎉 [PWA] Aplicación instalada con éxito.');
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    });

    // Check Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        console.log('🛠️ [PWA] Service Worker está listo.');
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const install = async () => {
    const promptToUse = deferredPrompt || globalDeferredPrompt;
    if (!promptToUse) return;

    promptToUse.prompt();
    const { outcome } = await promptToUse.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      setIsInstallable(false);
    }
  };

  return { isInstallable, isStandalone, install };
}
