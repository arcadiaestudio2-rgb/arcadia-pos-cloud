import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';
import { useOperator } from '../../context/OperatorContext';

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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <div className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center">
          <User size={14} />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[10px] font-bold uppercase tracking-tight text-slate-900">
            {selectedOperator?.name || 'Seleccionar Operador'}
          </p>
        </div>
        <ChevronDown size={12} className="text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-[99999]">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Seleccioná tu nombre
            </p>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {operators.length === 0 ? (
              <p className="p-4 text-xs text-center text-slate-400">Sin operadores disponibles</p>
            ) : (
              operators.map((op) => (
                <button
                  key={op.id}
                  onClick={() => {
                    setSelectedOperator(op);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold uppercase transition-all mb-1 ${
                    selectedOperator?.id === op.id 
                      ? 'bg-primary text-white' 
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{op.name}</span>
                  {selectedOperator?.id === op.id && <Check size={14} />}
                </button>
              ))
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate', { detail: 'operators' }));
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl transition-all"
            >
              Administrar Operadores
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
