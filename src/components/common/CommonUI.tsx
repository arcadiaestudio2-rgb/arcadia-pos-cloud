import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, X, Info, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useOperator } from '../../hooks/useOperator';

// --- BUTTONS ---
export const Button = ({ children, variant = 'primary', size = 'md', className = '', requiresOperator, ...props }: any) => {
  const { isOperatorSelected } = useOperator();
  
  // Heuristic: automatically require operator for common action labels if not explicitly set
  const actionLabels = ['guardar', 'confirmar', 'añadir', 'registrar', 'aplicar', 'actualizar', 'crear'];
  const buttonText = typeof children === 'string' ? children.toLowerCase() : '';
  const shouldRequireOperator = requiresOperator !== undefined 
    ? requiresOperator 
    : actionLabels.some(label => buttonText.includes(label));

  const isDisabled = props.disabled || (shouldRequireOperator && !isOperatorSelected);

  const variants: any = {
    primary: 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95',
    secondary: 'bg-on-surface text-white shadow-xl shadow-on-surface/20 hover:scale-[1.02] active:scale-95',
    tertiary: 'bg-tertiary text-white shadow-xl shadow-tertiary/20 hover:scale-[1.02] active:scale-95',
    outline: 'bg-transparent border-2 border-slate-100 text-slate-500 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-400 hover:text-primary hover:bg-primary/5',
    danger: 'bg-error text-white shadow-xl shadow-error/20 hover:scale-[1.02] active:scale-95',
    locked: 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-70 grayscale'
  };
  
  const sizes: any = {
    sm: 'px-4 py-2 text-[10px]',
    md: 'px-6 py-3 text-xs',
    lg: 'px-8 py-4 text-sm'
  };

  const activeVariant = isDisabled && shouldRequireOperator && !isOperatorSelected ? 'locked' : variant;

  return (
    <div className="relative group/btn">
      <button 
        className={`rounded-2xl font-black uppercase tracking-widest transition-all inline-flex items-center justify-center gap-2 ${variants[activeVariant]} ${sizes[size]} ${className}`}
        {...props}
        disabled={isDisabled}
      >
        {isDisabled && shouldRequireOperator && !isOperatorSelected && <UserX size={14} className="animate-pulse" />}
        {children}
      </button>
      
      {shouldRequireOperator && !isOperatorSelected && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-on-surface text-white text-[9px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/btn:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-2xl">
          Seleccioná tu nombre para operar
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-on-surface" />
        </div>
      )}
    </div>
  );
};

// --- STAT CARDS ---
export const StatCard = ({ icon: Icon, label, value, trend, color = 'primary', hideValue = false }: any) => {
  const colors: any = {
    primary: 'text-primary bg-primary/5',
    secondary: 'text-secondary bg-secondary/5',
    tertiary: 'text-tertiary bg-tertiary/5',
    error: 'text-error bg-error/5',
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        {trend && (
          <span className={`text-[10px] font-black uppercase ${trend > 0 ? 'text-tertiary' : 'text-error'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-3xl font-black font-headline tracking-tighter italic text-on-surface">
        {hideValue ? '••••••' : value}
      </h3>
    </div>
  );
};

// --- TOAST SYSTEM ---
let toastId = 0;
let toastListeners: any[] = [];

export const toast = {
  success: (msg: string) => notify(msg, 'success'),
  error: (msg: string) => notify(msg, 'error'),
  info: (msg: string) => notify(msg, 'info'),
};

const notify = (message: string, type: string) => {
  const id = toastId++;
  toastListeners.forEach(listener => listener({ id, message, type }));
};

export const Toaster = () => {
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    const listener = (newToast: any) => {
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 4000);
    };
    
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-3 pointer-events-none w-full max-w-md px-4">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } }}
            className={`pointer-events-auto w-full p-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
              t.type === 'success' ? 'bg-white border-emerald-100 text-emerald-600' :
              t.type === 'error'   ? 'bg-white border-rose-100 text-rose-600' :
                                     'bg-white border-indigo-100 text-indigo-600'
            }`}
          >
            <div className="shrink-0 p-2 rounded-xl bg-current/10">
              {t.type === 'success' && <CheckCircle2 size={20} />}
              {t.type === 'error'   && <AlertCircle  size={20} />}
              {t.type === 'info'    && <Info          size={20} />}
            </div>
            <p className="text-xs font-black uppercase tracking-widest flex-1 text-center leading-relaxed">
              {t.message}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// --- BRAND BLOCK ---
export const BrandBlock = ({ className = '', light = false }: any) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 to-indigo-800 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden group shrink-0">
        {/* Isologo: Minimalist A + Star */}
        <svg viewBox="0 0 24 24" className="w-8 h-8 fill-none stroke-current stroke-[2.5] relative z-10" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L4 22L12 17L20 22L12 2Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M12 2L4 22M12 2L20 22" />
          <path d="M7 16H17" />
        </svg>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex flex-col">
        <h1 className={`text-2xl font-black font-headline tracking-tighter leading-none ${light ? 'text-white' : 'text-slate-900'}`}>
          ArcadiAPP
        </h1>
        <p className={`text-[9px] font-black uppercase tracking-[0.25em] mt-1 ${light ? 'text-indigo-300' : 'text-indigo-600/60'}`}>
          Indumentaria Premium
        </p>
      </div>
    </div>
  );
};

export { formatCurrency, formatNumber, formatDate, compareSizes } from '../../utils/format';
