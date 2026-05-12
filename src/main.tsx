import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { OperatorProvider } from './context/OperatorContext';

// localStorage.clear(); // REMOVED: This was causing session loss on every reload

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <OperatorProvider>
        <App />
      </OperatorProvider>
    </AuthProvider>
  </StrictMode>,
);
