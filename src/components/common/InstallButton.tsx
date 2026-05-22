import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '../common/CommonUI';

export function InstallButton({ forceShow = false }: { forceShow?: boolean }) {
  const { isInstallable, isStandalone, install } = usePWAInstall();

  // If already in standalone mode, we don't need the install button
  if (isStandalone) return null;
  
  if (!isInstallable && !forceShow) return null;

  const handleClick = () => {
    if (isInstallable) {
      install();
    } else {
      toast.info('Instalación automática no disponible aún.', {
        description: 'Prueba recargando la página (F5) o usa "Instalar App" en el menú de tu navegador.',
        duration: 6000
      });
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={`group relative flex items-center gap-3 px-8 py-4 font-black rounded-3xl shadow-2xl transition-all text-[11px] uppercase tracking-[0.25em] overflow-hidden ${
        isInstallable 
          ? "bg-indigo-600 text-white shadow-indigo-500/20" 
          : "bg-white/10 text-white/70 border border-white/10 hover:bg-white/20"
      }`}
    >
      <div className="relative">
        <motion.div
          animate={isInstallable ? { y: [0, 2, 0] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-[2]" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </motion.div>
        {isInstallable && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        )}
      </div>
      <span className="relative z-10">
        {isInstallable ? "Instalar App" : "Guía de Instalación"}
      </span>
      
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </motion.button>
  );
}
