import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, DollarSign, Save } from 'lucide-react';
import { useOperator } from '../../hooks/useOperator';

interface FinancialAdjustmentModalProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { cost: number; margin: number; pvp: number; reason: string }) => Promise<void>;
}

export function FinancialAdjustmentModal({ product, isOpen, onClose, onSave }: FinancialAdjustmentModalProps) {
  const { selectedOperator } = useOperator();
  const [cost, setCost] = useState(product?.variants[0]?.cost || 0);
  const [margin, setMargin] = useState(product?.variants[0]?.margin || 0);
  const [pvp, setPvp] = useState(product?.priceRange?.min || 0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Recalculate PVP when cost or margin changes
  const handleCostChange = (val: string) => {
    const newCost = parseFloat(val) || 0;
    setCost(newCost);
    setPvp(newCost * (1 + margin / 100));
  };

  const handleMarginChange = (val: string) => {
    const newMargin = parseFloat(val) || 0;
    setMargin(newMargin);
    setPvp(cost * (1 + newMargin / 100));
  };

  const handlePvpChange = (val: string) => {
    const newPvp = parseFloat(val) || 0;
    setPvp(newPvp);
    if (cost > 0) {
      setMargin(((newPvp / cost) - 1) * 100);
    }
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      alert("El motivo es obligatorio");
      return;
    }
    setLoading(true);
    try {
      await onSave({ cost, margin, pvp, reason });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <DollarSign size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase text-on-surface tracking-tighter">Ajuste Financiero</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{product.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-on-surface transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Costo Base ($)</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Margen de Ganancia (%)</label>
                <input
                  type="number"
                  value={margin}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">PVP Final ($)</label>
                <input
                  type="number"
                  value={pvp}
                  onChange={(e) => handlePvpChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:outline-none focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-1.5 pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1">Motivo del Cambio *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Ej: Ajuste por inflación (Operador: ${selectedOperator?.name || 'Desconocido'})`}
                  className="w-full px-4 py-3 bg-slate-50 border border-primary/20 rounded-xl text-sm font-medium focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all resize-none min-h-[80px]"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !reason.trim()}
              className="flex-[2] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={16} />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
