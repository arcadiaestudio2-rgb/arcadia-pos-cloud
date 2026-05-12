import React, { useState } from 'react';
import { 
  Plus, 
  RotateCcw, 
  History, 
  Settings2,
  Package,
  ArrowDownToLine,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  Lock,
  UserCheck,
  ChevronDown,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StockList } from './StockList';
import { InventoryHistory } from './InventoryHistory';
import { useInventory } from '../../hooks/useInventory';
import { useOperator } from '../../context/OperatorContext';

const TABS = [
  { id: 'stock', label: 'Stock & Precios', icon: Package },
  { id: 'historial', label: 'Historial', icon: History },
];

export function InventoryManager() {
  const inventory = useInventory();
  const { 
    products, 
    movements, 
    loading, 
    error, 
    refresh, 
    loadMoreMovements,
    hasMore,
    loadingMore,
    updateStock,
    updateFinancialData,
    annulSession,
    categories,
    brands,
    seasons,
    colors,
    addAttribute,
    updateProduct,
    getProductById,
    deletedProducts,
    restoreProduct
  } = inventory;
  const [activeTab, setActiveTab] = useState('stock');
  const { selectedOperator, operatorName, setSelectedOperator, operators, isOperatorSelected } = useOperator();

  // Estadísticas dinámicas
  const criticalCount = products.filter(v => v.stock <= 0).length;
  const lowStockCount = products.filter(v => v.stock > 0 && v.stock <= v.stock_minimo).length;

  return (
    <div className="flex flex-col h-full bg-surface relative overflow-hidden">
      {/* Sticky Context Header */}
      <header className="sticky top-0 z-[60] bg-slate-50/80 backdrop-blur-md border-b border-slate-200/40 px-4 lg:px-8 py-4 lg:py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-2xl lg:text-3xl font-black font-headline tracking-tighter text-on-surface uppercase">Existencias</h2>
           <div className="hidden sm:flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-[10px] font-black text-slate-500 rounded uppercase">Audit Log: Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
           </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'product-new' }))}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white text-[10px] font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nuevo Producto</span>
          </button>

          {/* Tab Navigation */}
          <nav className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
                    isActive 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={14} className="lg:w-4 lg:h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 transition-all duration-700">
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'stock' && (
                  <StockList 
                    products={products}
                    loading={loading}
                    updateStock={updateStock}
                    updateFinancialData={updateFinancialData}
                    categories={Array.isArray(categories) ? categories.map(c => c.name) : []}
                    brands={Array.isArray(brands) ? brands.map(b => b.name) : []}
                    seasons={Array.isArray(seasons) ? seasons.map(s => s.name) : []}
                    allColors={Array.isArray(colors) ? colors.map(c => c.name) : []}
                    onAddAttribute={addAttribute}
                    onUpdateProduct={updateProduct}
                    onGetProductById={getProductById}
                    deletedProducts={deletedProducts}
                    restoreProduct={restoreProduct}
                  />
                )}
                {activeTab === 'historial' && (
                  <InventoryHistory 
                    movements={movements}
                    loading={loading}
                    loadingMore={loadingMore}
                    hasMore={hasMore}
                    loadMore={loadMoreMovements}
                    error={error}
                    annulSession={annulSession}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Global Status Bar */}
        <footer className="h-12 bg-on-surface text-white flex items-center px-10 justify-between text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
            <div className="flex gap-10">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-error shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                 <span>{criticalCount} SKUs Críticos</span>
              </div>
              <div className="flex items-center gap-2 border-l border-white/10 pl-10">
                 <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                 <span>{lowStockCount} SKUs Bajo Mínimo</span>
              </div>
            </div>
           <div className="flex items-center gap-4 text-white/40">
              <span>Operador: {String(operatorName || '---')}</span>
              <div className="w-px h-3 bg-white/10" />
              <span>Terminal: #HQ-01-BUE</span>
           </div>
        </footer>
      </div>

      {/* Security Overlay */}
      <AnimatePresence>
        {!isOperatorSelected && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-12 rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col items-center text-center max-w-md mx-4"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-8">
                <Lock size={40} />
              </div>
              <h3 className="text-3xl font-black text-on-surface uppercase tracking-tight mb-4 font-headline">Acceso Restringido</h3>
              <p className="text-slate-500 font-medium mb-10 leading-relaxed">
                Para realizar movimientos de inventario, ajustes de precio o ver el historial, primero debes <span className="text-primary font-black">seleccionar tu nombre de operador</span> en el selector superior.
              </p>
              <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 animate-bounce">
                <UserCheck size={20} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Usá el selector del Header</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
