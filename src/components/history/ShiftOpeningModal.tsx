import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, DollarSign, Wallet, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface Props {
  onClose: () => void;
  onSave?: (balance: number) => void;
}

export function ShiftOpeningModal({ onClose, onSave }: Props) {
  const storedBalance = localStorage.getItem('arcadia_cash_starting_balance');
  const initialValue = storedBalance ? parseFloat(storedBalance) : 0;
  const [balance, setBalance] = useState<string>(initialValue > 0 ? initialValue.toString() : '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = balance === '' ? 0 : parseFloat(balance);
    if (isNaN(numValue) || numValue < 0) return;

    localStorage.setItem('arcadia_cash_starting_balance', numValue.toString());
    
    // Dispatch a custom event to notify ShiftSummary and other listeners
    window.dispatchEvent(new CustomEvent('shift-balance-updated', { detail: numValue }));

    if (onSave) {
      onSave(numValue);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-on-surface/60 backdrop-blur-md" 
      />

      {/* Modal Content */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-[500px] rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col"
      >
        <header className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                 <Wallet size={20} />
              </div>
              <div>
                 <h3 className="text-lg font-black font-headline tracking-tight uppercase">Apertura de Caja</h3>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Saldo inicial de Turno</p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-error transition-all"
           >
              <X size={18} />
           </button>
        </header>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ingresar Saldo Inicial (Efectivo)</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                <DollarSign size={20} />
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                placeholder="0.00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full h-16 bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 text-xl font-bold tracking-tight text-on-surface focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="p-4 bg-tertiary/[0.03] border border-tertiary/10 rounded-2xl flex gap-3 items-start">
             <div className="w-5 h-5 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary shrink-0 mt-0.5">
               <CheckCircle2 size={12} />
             </div>
             <p className="text-xs font-medium text-slate-500 uppercase leading-normal">
               El saldo inicial servirá como punto de partida para calcular el efectivo final disponible al cierre del turno.
             </p>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              Omitir
            </button>
            <button
              type="submit"
              className="flex-1 py-4 bg-primary text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-primary/20"
            >
              Guardar y Abrir Turno
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
