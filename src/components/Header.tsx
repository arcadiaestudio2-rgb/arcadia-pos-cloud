import React from 'react';
import { Bell, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { OperatorSelector } from './Header/OperatorSelector';
import { api } from '../services/api';
import { SyncStatus } from './common/SyncStatus';
import { InstallButton } from './common/InstallButton';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const [isSandbox, setIsSandbox] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);

  React.useEffect(() => {
    api.getSandboxStatus().then(config => {
      setIsSandbox(config.isSandbox);
    });
  }, []);

  return (
    <header className="h-14 lg:h-16 bg-white sticky top-0 z-[999] border-b border-slate-200/50 flex items-center justify-between px-4 lg:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex-1 max-w-xl hidden md:block">
        </div>

        {isSandbox && (
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full animate-pulse shadow-sm shadow-orange-500/5">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-tight hidden sm:inline">
              Sandbox
            </span>
          </div>
        )}
        
        <SyncStatus />
        <InstallButton />
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <OperatorSelector />
        
        <div className="h-6 w-px bg-slate-100 mx-1" />

        <div className="flex items-center gap-2 lg:gap-3 cursor-pointer group relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
              isNotificationsOpen ? 'bg-primary text-white' : 'text-slate-500 hover:text-primary hover:bg-slate-50'
            }`}
          >
            <Bell size={18} />
          </button>
          
          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full mt-2 right-0 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 z-[9999] overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Notificaciones</h3>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase">0 Nuevas</span>
                </div>
                
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-3">
                    <Bell size={24} strokeWidth={1} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No tienes notificaciones pendientes</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <img 
              src={`https://ui-avatars.com/api/?name=${user?.name || 'U'}&background=4F46E5&color=fff`}
              alt="User" 
              className="w-8 h-8 lg:w-9 lg:h-9 rounded-full border-2 border-white shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-tertiary border-2 border-white rounded-full" />
          </div>
        </div>
      </div>
    </header>
  );
}
