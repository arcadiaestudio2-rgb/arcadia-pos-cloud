import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { OperatorProvider } from './context/OperatorContext';
import { registerSW } from 'virtual:pwa-register';
import { initAppRealtime } from './realtime/realtimeBootstrap';

// Register PWA Service Worker
registerSW({ immediate: true });

// Initialize Realtime Deterministic Pipeline (Bootstrap)
initAppRealtime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <OperatorProvider>
        <App />
      </OperatorProvider>
    </AuthProvider>
  </StrictMode>,
);
