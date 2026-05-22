import React, { useState } from 'react';
import { 
  X, 
  Save,
  Percent,
  Settings2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { db } from '../../db/database';
import { motion, AnimatePresence } from 'motion/react';
import { PaymentFees } from './POS';

interface SurchargeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  fees: PaymentFees;
  onUpdateFees: (fees: PaymentFees) => void;
}

export const SurchargeConfigModal: React.FC<SurchargeConfigModalProps> = ({
  isOpen,
  onClose,
  fees,
  onUpdateFees
}) => {
  const [localFees, setLocalFees] = useState<PaymentFees>(fees);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFees(localFees);
    onClose();
  };

  const updateCreditSurcharge = (installments: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalFees(prev => ({
      ...prev,
      creditSurcharges: {
        ...prev.creditSurcharges,
        [installments]: numValue
      }
    }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border-2 border-on-surface flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-on-surface text-white rounded-lg flex items-center justify-center">
                  <Settings2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Recargos y Descuentos</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuración de métodos de pago</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desc. Efectivo (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-lg px-4 font-bold focus:border-on-surface outline-none transition-all"
                      value={localFees.cashDiscount}
                      onChange={(e) => setLocalFees({...localFees, cashDiscount: parseFloat(e.target.value) || 0})}
                    />
                    <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rec. QR (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-lg px-4 font-bold focus:border-on-surface outline-none transition-all"
                      value={localFees.qrSurcharge}
                      onChange={(e) => setLocalFees({...localFees, qrSurcharge: parseFloat(e.target.value) || 0})}
                    />
                    <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rec. Débito (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-lg px-4 font-bold focus:border-on-surface outline-none transition-all"
                      value={localFees.debitSurcharge}
                      onChange={(e) => setLocalFees({...localFees, debitSurcharge: parseFloat(e.target.value) || 0})}
                    />
                    <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Recargos Tarjeta de Crédito</h3>
                  <div className="h-[2px] flex-1 bg-slate-100" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {[1, 3, 6, 9, 12].map(inst => (
                    <div key={inst} className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{inst} {inst === 1 ? 'Pago' : 'Cuotas'} (%)</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full h-12 bg-slate-50 border-2 border-slate-100 rounded-lg px-4 font-bold focus:border-on-surface outline-none transition-all"
                          value={localFees.creditSurcharges[inst] || 0}
                          onChange={(e) => updateCreditSurcharge(inst, e.target.value)}
                        />
                        <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-100 flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                  Los cambios se aplicarán inmediatamente a las nuevas ventas y cálculos en el checkout. No afectan ventas ya realizadas.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Mantenimiento y Recuperación</h3>
                  <div className="h-[1px] flex-1 bg-rose-100" />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("¿Está seguro de que desea limpiar la cola de sincronización? Esto eliminará todas las tareas pendientes de subida a la nube.")) {
                      try {
                        await db.sync_queue.clear();
                        alert("Cola de sincronización limpiada con éxito.");
                      } catch (e) {
                        alert("Error al limpiar la cola.");
                      }
                    }
                  }}
                  className="w-full flex items-center justify-center gap-3 p-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 hover:bg-rose-100 transition-all group"
                >
                  <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-black uppercase tracking-widest">Limpiar Cola de Sincronización</span>
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t-2 border-slate-100 flex gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 h-12 px-6 border-2 border-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-[2] h-12 bg-on-surface text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-on-surface/20 transition-all"
              >
                <Save size={16} />
                Guardar Configuración
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
