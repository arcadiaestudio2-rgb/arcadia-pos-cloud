import React, { useState, useRef, useEffect } from 'react';
import { 
  RotateCcw, 
  Search, 
  ShieldAlert, 
  Info,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../services/api';
import { useInventory } from '../../hooks/useInventory';
import { useOperator } from '../../context/OperatorContext';
import { toast } from '../common/CommonUI';

const REASONS = [
  { id: 'breakage', label: 'Rotura / Daño', icon: '💥' },
  { id: 'theft', label: 'Robo / Hurto', icon: '🕵️' },
  { id: 'gift', label: 'Regalo / Atención', icon: '🎁' },
  { id: 'error', label: 'Error Administrativo', icon: '📝' },
  { id: 'other', label: 'Otros', icon: '➕' }
];

export function StockAdjustment() {
  const { updateStock } = useInventory();
  const { selectedOperator } = useOperator();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [selectedReason, setSelectedReason] = useState('');
  const [observations, setObservations] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const triggerSearch = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const results = await api.searchProducts(term);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSincronizar = async () => {
    if (!selectedOperator) {
      toast.error("Seleccione un operador en la barra superior");
      return;
    }
    if (!selectedProduct || adjustmentValue === 0 || !selectedReason) {
      toast.error("Complete todos los campos obligatorios");
      return;
    }

    try {
      const type = adjustmentValue > 0 ? 'INGRESO' : 'EGRESO';
      const absQuantity = Math.abs(adjustmentValue);
      const reasonLabel = REASONS.find(r => r.id === selectedReason)?.label || 'Otros';
      
      await updateStock(
        selectedProduct.id,
        absQuantity,
        type,
        observations || `Ajuste manual: ${reasonLabel}`,
        reasonLabel
      );

      // Reset form
      setSelectedProduct(null);
      setAdjustmentValue(0);
      setSelectedReason('');
      setObservations('');
      setSearchTerm('');
    } catch (err) {
      console.error(err);
    }
  };

  const isInvalid = !selectedProduct || adjustmentValue === 0 || !selectedReason;

  return (
    <div className="grid grid-cols-12 gap-10 items-start">
      
      {/* Search & Audit Context */}
      <div className="col-span-12 lg:col-span-5 space-y-10">
        
        <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
           <div className="flex items-center gap-3">
              <ShieldAlert size={20} className="text-secondary" />
              <h3 className="text-sm font-black uppercase tracking-[0.25em] text-on-surface">Auditoría de Ajuste</h3>
           </div>

           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar Item Maestro</label>
                 <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      ref={searchInputRef}
                      className="w-full h-16 bg-slate-50 border-none rounded-3xl pl-16 pr-6 text-sm font-bold focus:ring-4 focus:ring-secondary/5 outline-none transition-all"
                      placeholder="SKU, EAN o Nombre..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        triggerSearch(e.target.value);
                      }}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                       {loadingSearch && <Loader2 className="animate-spin text-secondary" size={18} />}
                    </div>

                    <AnimatePresence>
                      {searchResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-[300px] overflow-y-auto p-2"
                        >
                          {searchResults.map(v => (
                            <button
                              key={v.id}
                              onClick={() => {
                                setSelectedProduct(v);
                                setSearchTerm('');
                                setSearchResults([]);
                              }}
                              className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 rounded-xl transition-colors text-left"
                            >
                              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-secondary font-black text-[10px]">
                                {v.size}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{v.sku}</p>
                                <p className="text-xs font-bold text-on-surface truncate">{v.name || v.products?.name}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-secondary">Stock: {v.stock}</p>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
              </div>

              {selectedProduct && (
                 <div className="p-6 rounded-3xl border border-slate-100 flex items-center gap-5 bg-surface/30">
                    <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-secondary font-black text-xs">
                      {selectedProduct.size}
                    </div>
                    <div className="flex-1">
                       <p className="text-[10px] font-mono font-bold text-slate-400 mb-0.5">{selectedProduct.sku}</p>
                       <h4 className="text-sm font-black text-on-surface leading-tight uppercase">{selectedProduct.name || selectedProduct.products?.name}</h4>
                       <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Stock Operativo:</span>
                          <span className={`text-xs font-black ${selectedProduct.stock < (selectedProduct.stock_minimo || 5) ? 'text-error' : 'text-tertiary'}`}>
                             {selectedProduct.stock} u.
                          </span>
                       </div>
                    </div>
                    <button 
                      onClick={() => setSelectedProduct(null)}
                      className="text-slate-300 hover:text-error transition-colors"
                    >
                      <RotateCcw size={16} />
                    </button>
                 </div>
              )}
           </div>
        </section>

        {/* Reason & Value Card */}
        <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
           <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo del Desvío (Mandatorio)</label>
              <div className="grid grid-cols-2 gap-3">
                 {REASONS.map(r => (
                    <button 
                       key={r.id}
                       onClick={() => setSelectedReason(r.id)}
                       className={`h-14 rounded-2xl border transition-all flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest ${
                         selectedReason === r.id 
                           ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20' 
                           : 'bg-white border-slate-100 text-slate-400 hover:border-secondary/30'
                       }`}
                    >
                       <span className="text-base">{r.icon}</span>
                       {r.label}
                    </button>
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Variación de Cantidad</label>
              <div className="flex items-center gap-6">
                 <div className="flex-1 flex items-center justify-between p-2 bg-slate-50 rounded-3xl h-14">
                    <button 
                       onClick={() => setAdjustmentValue(v => v - 1)}
                       className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-error"
                    >-</button>
                    <div className="flex items-center gap-2">
                       <input 
                         type="number" 
                         className="w-16 bg-transparent border-none text-center text-xl font-black text-on-surface focus:ring-0"
                         value={adjustmentValue} 
                         onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                       />
                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Unidades</span>
                    </div>
                    <button 
                       onClick={() => setAdjustmentValue(v => v + 1)}
                       className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-tertiary"
                    >+</button>
                 </div>
              </div>
           </div>
        </section>

      </div>

      {/* Audit Confirmation & Finalization */}
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-10">
         
         <section className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex-1 space-y-10">
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <FileText size={20} className="text-slate-400" />
                 <h3 className="text-sm font-black uppercase tracking-[0.25em] text-on-surface">Documentación y Notas</h3>
               </div>
               <div className="flex items-center gap-3">
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    adjustmentValue > 0 ? 'bg-tertiary/10 text-tertiary' : adjustmentValue < 0 ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {adjustmentValue > 0 ? '+ INCREMENTO' : adjustmentValue < 0 ? '- DECREMENTO' : 'SIN CAMBIOS'}
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observaciones de Auditoría</label>
               <textarea 
                  className="w-full h-48 bg-slate-50/50 border border-slate-100 rounded-[2rem] p-8 text-sm font-medium focus:ring-4 focus:ring-secondary/5 outline-none transition-all resize-none"
                  placeholder="Detalle el motivo técnico o administrativo del ajuste..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
               />
            </div>

            {selectedProduct && (
               <div className="bg-on-surface p-10 rounded-[2.5rem] text-white space-y-8 relative overflow-hidden">
                  <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-[80px]" />
                  
                  <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-10">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Stock Actual</p>
                        <p className="text-4xl font-black font-headline tracking-tighter italic">{selectedProduct.stock} u.</p>
                     </div>
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Post-Ajuste</p>
                        <p className="text-4xl font-black font-headline tracking-tighter italic text-secondary">
                           {selectedProduct.stock + adjustmentValue} u.
                        </p>
                     </div>
                  </div>

                  <div className="relative z-10 h-px bg-white/10" />

                  <div className="relative z-10 flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/5">
                     <div className="flex items-center gap-4">
                        <Info size={18} className="text-secondary" />
                        <p className="text-[10px] font-bold text-white/60 uppercase leading-relaxed max-w-xs">
                           Se generará un ticket de movimiento inmutable vinculado a su ID de operador.
                        </p>
                     </div>
                     <CheckCircle2 size={32} className={isInvalid ? 'text-white/10' : 'text-secondary'} />
                  </div>
               </div>
            )}

            <button 
               disabled={isInvalid}
               className="w-full py-6 bg-secondary text-white font-black rounded-3xl shadow-2xl shadow-secondary/20 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 disabled:opacity-20 disabled:grayscale"
               onClick={handleSincronizar}
            >
               <RotateCcw size={20} />
               Sincronizar Ajuste Maestro
            </button>
         </section>
      </div>
    </div>
  );
}
