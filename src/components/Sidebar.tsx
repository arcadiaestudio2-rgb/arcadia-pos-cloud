import React from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  User, 
  History, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  Warehouse,
  ChevronRight,
  X,
  Users
} from 'lucide-react';
import { BrandBlock } from './common/CommonUI';
import { AnimatePresence, motion } from 'motion/react';


interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
  { id: 'inventory', label: 'Gestión Maestra', icon: Warehouse },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'operators', label: 'Operadores', icon: Users },
  { id: 'config', label: 'Configuración', icon: Settings },
  { id: 'profile', label: 'Perfil', icon: User },
];

export function Sidebar({ activeTab, setActiveTab, isOpen, onClose }: SidebarProps) {

  const content = (
    <aside className={`w-64 h-screen bg-white border-r border-slate-100 flex flex-col py-6 z-50 shadow-2xl lg:shadow-none`}>
      <div className="px-6 mb-8 flex items-center justify-between">
        <BrandBlock />
        <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-primary">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-600 font-bold' 
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          );
        })}
      </nav>


      <div className="px-6 mt-auto">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Estado del Plan</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary">Enterprise Elite</span>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0">
        {content}
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden fixed inset-0 z-[100]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0"
            >
              {content}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
