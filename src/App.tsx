/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ProductEditor } from './components/catalog/ProductEditor';
import { InventoryManager } from './components/inventory/InventoryManager';
import POS from './components/pos/POS';
import { POSSettings } from './components/config/StoreSettings';
import { HistoryManager } from './components/history/HistoryManager';
import { ProfileSettings } from './components/profile/ProfileSettings';
import { Toaster } from './components/common/CommonUI';
import { useAuth } from './context/AuthContext';
import { useOperator } from './context/OperatorContext';
import { Login } from './components/auth/Login';
import { InitialOperatorSetup } from './components/auth/InitialOperatorSetup';
import { OperatorManager } from './components/auth/OperatorManager';
import { ShiftOpeningModal } from './components/history/ShiftOpeningModal';
import { api } from './services/api';
import { SyncService } from './services/syncService';

function AppContent() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { operators, isLoading: isOperatorLoading } = useOperator();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showShiftOpening, setShowShiftOpening] = useState(false);

  // Simple navigation listener for development
  React.useEffect(() => {
    const handleNav = (e: any) => {
      let targetTab = '';
      let targetProduct = null;

      if (typeof e.detail === 'string') {
        targetTab = e.detail;
      } else {
        targetTab = e.detail.tab;
        targetProduct = e.detail.product || null;
      }

      setActiveTab(targetTab);
      setEditingProduct(targetProduct);
      setSidebarOpen(false);
    };
    window.addEventListener('navigate', handleNav);
    return () => window.removeEventListener('navigate', handleNav);
  }, []);

  const syncInitialized = React.useRef(false);

  // Initialize Sync Service and Mirroring
  React.useEffect(() => {
    if (isAuthenticated && !syncInitialized.current) {
      syncInitialized.current = true;
      // Start background sync
      SyncService.start();
      
      // Perform initial mirror
      api.mirrorCloudToLocal();
    }
  }, [isAuthenticated]);

  // Check initial shift status on launch
  React.useEffect(() => {
    if (isAuthenticated) {
      setActiveTab('dashboard');
      const shown = sessionStorage.getItem('arcadia_initial_prompt_shown');
      const hasBalance = localStorage.getItem('arcadia_cash_starting_balance');
      
      if (!shown && !hasBalance) {
        setShowShiftOpening(true);
        sessionStorage.setItem('arcadia_initial_prompt_shown', 'true');
      }
    }
  }, [isAuthenticated]);

  // Handle open-shift-opening-modal event
  React.useEffect(() => {
    const handleOpen = () => setShowShiftOpening(true);
    window.addEventListener('open-shift-opening-modal', handleOpen);
    return () => window.removeEventListener('open-shift-opening-modal', handleOpen);
  }, []);

  // --- CONDITIONAL RETURNS (RULES OF HOOKS: MUST BE AFTER ALL HOOK DECOARATIONS) ---

  // 1. Loading State (Sync both Auth and Operator)
  if (isAuthLoading || isOperatorLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <span className="text-2xl text-primary font-black">★</span>
          </div>
          <div className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-2xl animate-spin" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-black text-on-surface tracking-tighter italic">ARCADIA<span className="text-primary">PP</span></h2>
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">Cargando Sistema...</p>
        </div>
      </div>
    );
  }

  // 2. Authentication State
  if (!isAuthenticated) {
    return <Login />;
  }

  // 3. Initial Setup State (If authenticated but no operators exist)
  if (operators.length === 0) {
    return <InitialOperatorSetup />;
  }

  // --- MAIN RENDER LOGIC ---

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return <InventoryManager />;
      case 'pos':
        return <POS onMenuClick={() => setSidebarOpen(true)} />;
      case 'history':
        return <HistoryManager />;
      case 'operators':
        return <OperatorManager />;
      case 'profile':
        return <ProfileSettings />;
      case 'config':
        return <POSSettings />;
      case 'product-new':
        return <ProductEditor product={editingProduct} onClose={() => { setActiveTab('inventory'); setEditingProduct(null); }} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] text-slate-400">
            <div className="p-12 rounded-3xl bg-white shadow-sm border border-slate-50 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-2xl font-black text-primary/20">?</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-1">Módulo en Desarrollo</h3>
              <p className="text-sm">Estamos preparando esta sección de ARCADIA<span className="font-bold">PP</span></p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex overflow-hidden relative">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSidebarOpen(false);
        }} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="flex-1 lg:ml-64 flex flex-col h-screen overflow-hidden">
        {activeTab !== 'pos' && <Header onMenuClick={() => setSidebarOpen(true)} />}
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>

      {showShiftOpening && (
        <React.Suspense fallback={null}>
          <ShiftOpeningModal onClose={() => setShowShiftOpening(false)} />
        </React.Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <>
      <AppContent />
      <Toaster />
    </>
  );
}
