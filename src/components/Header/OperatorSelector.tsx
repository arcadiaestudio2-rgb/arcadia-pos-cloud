import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';
import { useOperator } from '../../context/OperatorContext';
import { motion, AnimatePresence } from 'motion/react';

export const OperatorSelector = () => {
  const { selectedOperator, setSelectedOperator, operators } = useOperator();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative mx-1" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${
          selectedOperator 
            ? 'bg-slate-50/50 border-slate-200/60 hover:border-primary/30 shadow-sm' 
            : 'bg-primary/5 border-primary/20 animate-pulse'
        }`}
      >
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
          selectedOperator ? 'bg-slate-50 text-slate-400' : 'bg-primary text-white'
        }`}>
          <User size={14} />
        </div>
        
        <div className="text-left hidden sm:block">
          <p className={`text-[10px] font-bold uppercase tracking-tight ${
            selectedOperator ? 'text-slate-600' : 'text-primary italic'
          }`}>
            {selectedOperator?.name || 'Operador'}
          </p>
        </div>

        <ChevronDown 
          size={12} 
          className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full mt-4 right-0 w-64 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-3 z-[99999] overflow-hidden"
          >
            <div className="px-3 py-2 mb-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                Seleccioná tu nombre
              </p>
            </div>
            
            {operators.map((op) => (
              <button
                key={op.id}
                onClick={() => {
                  setSelectedOperator(op);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedOperator?.id === op.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {op.name}
                {selectedOperator?.id === op.id && <Check size={14} />}
              </button>
            ))}

            {selectedOperator && (
              <>
                <div className="h-px bg-slate-50 my-2" />
                <button
                  onClick={() => {
                    setSelectedOperator(null);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest text-error hover:bg-error/5 rounded-lg transition-colors"
                >
                  Cerrar Sesión de Operador
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
