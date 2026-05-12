import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  Search, 
  MapPin, 
  Truck, 
  CheckCircle2, 
  Printer, 
  Scale,
  DollarSign,
  AlertCircle,
  Plus,
  X,
  Keyboard,
  TrendingUp,
  FileCheck,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../services/api';
import { useInventory } from '../../hooks/useInventory';
import { useOperator } from '../../context/OperatorContext';
import { toast } from '../common/CommonUI';

interface EntryItem {
  id: string;
  variantId: number;
  sku: string;
  name: string;
  quantity: number;
  cost: number;
  catalogCost: number;
  updateCatalog: boolean;
  location: string;
}

export function StockEntry() {
  const { bulkUpdateStock } = useInventory();
  const { selectedOperator } = useOperator();
  const [burstMode, setBurstMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [items, setItems] = useState<EntryItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [locations, setLocations] = useState({
    warehouse: 'Depósito Central',
    aisle: 'Pasillo 1',
    shelf: 'Estante A'
  });

  // Real search logic
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

  const handleScan = async (term: string) => {
    if (!term) return;
    
    setLoadingSearch(true);
    try {
      // Try SKU first
      const variant = await api.getVariantBySku(term);
      if (variant) {
        addItemFromVariant(variant);
        setSearchTerm('');
        setSearchResults([]);
        return;
      }

      // Try general search
      const results = await api.searchProducts(term);
      if (results.length === 1 && burstMode) {
        addItemFromVariant(results[0]);
        setSearchTerm('');
        setSearchResults([]);
      } else if (results.length > 0) {
        setSearchResults(results);
      } else {
        toast.error("Producto no encontrado");
      }
    } catch (err) {
      toast.error("Error en la búsqueda");
    } finally {
      setLoadingSearch(false);
      searchInputRef.current?.focus();
    }
  };

  const addItemFromVariant = (v: any) => {
    setItems(prev => {
      const existing = prev.find(i => i.variantId === v.id);
      if (existing) {
        return prev.map(i => i.variantId === v.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: Math.random().toString(36),
        variantId: v.variant_id || v.id,
        sku: v.sku,
        name: `${v.name || v.products?.name} (${v.size} - ${v.color})`,
        quantity: 1,
        cost: v.cost || 0,
        catalogCost: v.cost || 0,
        updateCatalog: false,
        location: `${locations.warehouse} > ${locations.aisle} > ${locations.shelf}`
      }];
    });
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: string, field: keyof EntryItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleRegister = async () => {
    if (!selectedOperator) {
      toast.error("Seleccione un operador en la barra superior");
      return;
    }

    try {
      const updates = items.map(i => ({
        variantId: i.variantId,
        quantity: i.quantity,
        type: 'INGRESO' as const,
        reason: `Ingreso de mercadería${selectedSupplier ? ` - Prov: ${selectedSupplier}` : ''}`
      }));

      await bulkUpdateStock(updates);
      
      // Handle catalog cost updates if any
      const toUpdateCatalog = items.filter(i => i.updateCatalog && i.cost !== i.catalogCost);
      if (toUpdateCatalog.length > 0) {
        // We should ideally have a bulk update for product costs too, 
        // but for now we can do it individually or omit if not critical
        // Let's at least log it or implement if api allows
      }

      setItems([]);
      setSearchTerm('');
      toast.success("Ingreso registrado correctamente");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-8 items-start">
      
      {/* Control Panel (Entry & Logistics) */}
      <div className="col-span-12 lg:col-span-4 space-y-8">
        
        {/* Entry Strategy Card */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <Zap className={burstMode ? 'text-primary' : 'text-slate-300'} size={18} />
                 <h3 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Estrategia de Carga</h3>
              </div>
              <button 
                onClick={() => setBurstMode(!burstMode)}
                className={`w-14 h-7 rounded-full p-1 transition-all ${burstMode ? 'bg-primary' : 'bg-slate-100'}`}
              >
                 <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${burstMode ? 'translate-x-7' : 'translate-x-0'}`} />
              </button>
           </div>

           <div className="p-4 rounded-2xl bg-primary/5 flex gap-3 items-start">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
                 <Zap size={14} />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Burst Scan Mode {burstMode ? 'ON' : 'OFF'}</p>
                 <p className="text-[9px] font-medium text-primary/60 mt-1 uppercase leading-tight">
                    {burstMode ? 'El escaneo automático añade +1 unidad y resetea el foco.' : 'Elija productos manualmente para configurar costos específicos.'}
                 </p>
              </div>
           </div>

           <div className="space-y-4">
              <div className="relative">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                 <input 
                    ref={searchInputRef}
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl pl-14 pr-12 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    placeholder="Escanear Código o Buscar SKU..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (!burstMode) triggerSearch(e.target.value);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan(searchTerm)}
                 />
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {loadingSearch ? (
                      <Loader2 className="animate-spin text-primary" size={18} />
                    ) : (
                      <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-300">ENTER</kbd>
                    )}
                 </div>

                 {/* Search Results Dropdown */}
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
                             addItemFromVariant(v);
                             setSearchTerm('');
                             setSearchResults([]);
                           }}
                           className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 rounded-xl transition-colors text-left"
                         >
                           <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-primary font-black text-[10px]">
                             {v.size}
                           </div>
                           <div className="flex-1 min-w-0">
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{v.sku}</p>
                             <p className="text-xs font-bold text-on-surface truncate">{v.name || v.products?.name}</p>
                             <p className="text-[9px] font-medium text-slate-400">{v.color}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-xs font-black text-primary">${v.cost?.toLocaleString()}</p>
                             <p className="text-[9px] font-bold text-slate-300">Stock: {v.stock}</p>
                           </div>
                         </button>
                       ))}
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>
           </div>
        </section>

        {/* Logistics Context Card */}
        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
           <div className="flex items-center gap-3">
              <MapPin size={18} className="text-slate-400" />
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">Ubicación y Origen</h3>
           </div>

           <div className="space-y-4">
              <div className="space-y-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Jerarquía de Almacén</label>
                 <div className="grid grid-cols-3 gap-2">
                    <select 
                      className="h-10 bg-slate-50 border-none rounded-xl px-3 text-[10px] font-bold outline-none" 
                      value={locations.warehouse}
                      onChange={(e) => setLocations(prev => ({...prev, warehouse: e.target.value}))}
                    >
                       <option>Depósito Central</option>
                       <option>Local MDQ</option>
                    </select>
                    <select 
                      className="h-10 bg-slate-50 border-none rounded-xl px-3 text-[10px] font-bold outline-none"
                      value={locations.aisle}
                      onChange={(e) => setLocations(prev => ({...prev, aisle: e.target.value}))}
                    >
                       <option>Pasillo 1</option>
                       <option>Pasillo 2</option>
                    </select>
                    <select 
                      className="h-10 bg-slate-50 border-none rounded-xl px-3 text-[10px] font-bold outline-none"
                      value={locations.shelf}
                      onChange={(e) => setLocations(prev => ({...prev, shelf: e.target.value}))}
                    >
                       <option>Estante A</option>
                       <option>Estante B</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Proveedor Vinculado</label>
                 <div className="relative">
                    <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <select 
                      className="w-full h-12 bg-slate-50 border-none rounded-2xl pl-12 pr-4 text-xs font-bold outline-none"
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                    >
                       <option value="">Seleccionar Proveedor...</option>
                       <option>Alpine Distribution S.A.</option>
                       <option>Zen Logistics Intl</option>
                    </select>
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white text-primary rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                       <Plus size={16} />
                    </button>
                 </div>
              </div>
           </div>
        </section>

        <button 
          disabled={items.length === 0}
          className="w-full py-5 bg-primary text-white font-black rounded-[2.5rem] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:scale-100"
          onClick={handleRegister}
        >
           <CheckCircle2 size={20} />
           Registrar Ingreso
        </button>
      </div>

      {/* Session Worksheet (Batch Table) */}
      <div className="col-span-12 lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-h-[700px] overflow-hidden">
         <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <div>
               <h3 className="text-xl font-black font-headline tracking-tighter uppercase">Planilla de Carga Actual</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sesión: #S-{new Date().getTime().toString().slice(-6)}</p>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-2xl font-black font-headline tracking-tighter italic text-on-surface">
                  {items.reduce((acc, curr) => acc + curr.quantity, 0)} <span className="text-xs uppercase opacity-30 not-italic">u.</span>
               </span>
               <div className="w-px h-8 bg-slate-200 mx-2" />
               <button className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-50">
                  <Printer size={14} /> Etiquetado Masivo
               </button>
            </div>
         </div>

         <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                     <th className="py-4 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400">Producto / SKU</th>
                     <th className="py-4 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400">Ubicación</th>
                     <th className="py-4 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Cantidad</th>
                     <th className="py-4 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Costo Unit.</th>
                     <th className="py-4 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Sync Costo</th>
                     <th className="py-4 px-8"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  <AnimatePresence>
                    {items.map((item) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="group hover:bg-slate-50/30 transition-colors"
                      >
                         <td className="py-4 px-8">
                            <p className="text-[10px] font-mono font-bold text-slate-300">{item.sku}</p>
                            <p className="text-xs font-black text-on-surface uppercase tracking-tight">{item.name}</p>
                         </td>
                         <td className="py-4 px-8">
                            <span className="px-2 py-1 bg-slate-100 text-[9px] font-bold text-slate-500 rounded-lg">
                               {item.location}
                            </span>
                         </td>
                         <td className="py-4 px-8">
                            <div className="flex items-center justify-center gap-3">
                               <button 
                                 onClick={() => updateItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                                 className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-primary"
                               >-</button>
                               <span className="text-sm font-black text-on-surface w-6 text-center">{item.quantity}</span>
                               <button 
                                 onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)}
                                 className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 text-slate-400 hover:text-primary"
                               >+</button>
                            </div>
                         </td>
                         <td className="py-4 px-8 text-right">
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1">
                                 <span className="text-[10px] text-slate-300 opacity-60">$</span>
                                 <input 
                                   type="number"
                                   className="w-24 text-right bg-transparent border-none text-sm font-black text-on-surface focus:ring-2 focus:ring-primary/10 rounded-lg p-1"
                                   value={item.cost}
                                   onChange={(e) => updateItem(item.id, 'cost', Number(e.target.value))}
                                 />
                              </div>
                              {item.cost !== item.catalogCost && (
                                <span className="text-[8px] font-black text-tertiary uppercase flex items-center gap-1 mt-1">
                                   <TrendingUp size={10} /> Dif: ${Math.abs(item.cost - item.catalogCost).toLocaleString()} 
                                </span>
                              )}
                            </div>
                         </td>
                         <td className="py-4 px-8">
                            <div className="flex items-center justify-center">
                               <label className="relative inline-flex items-center cursor-pointer group">
                                  <input 
                                    type="checkbox" 
                                    checked={item.updateCatalog}
                                    onChange={(e) => updateItem(item.id, 'updateCatalog', e.target.checked)}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-5 h-5 bg-slate-100 border border-slate-200 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                                     {item.updateCatalog && <CheckCircle2 size={12} className="text-white" />}
                                  </div>
                               </label>
                            </div>
                         </td>
                         <td className="py-4 px-8 text-right">
                             <button 
                               onClick={() => removeItem(item.id)}
                               className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:bg-error/5 hover:text-error transition-all"
                             >
                                <X size={16} />
                             </button>
                         </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  
                  {items.length === 0 && (
                    <tr>
                       <td colSpan={6} className="py-32 text-center opacity-20">
                          <Keyboard size={48} className="mx-auto text-slate-200 mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escanee para comenzar sesión de carga</p>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>

         {/* Financial Summary Overlay */}
         {items.length > 0 && (
            <div className="p-8 bg-slate-50 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Inversión Total Bruta</span>
                  <span className="text-xl font-black text-on-surface font-headline italic">
                     ${items.reduce((acc, curr) => acc + (curr.cost * curr.quantity), 0).toLocaleString('es-AR')}
                  </span>
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SKUs Únicos</span>
                  <span className="text-xl font-black text-on-surface font-headline italic">{items.length}</span>
               </div>
               <div className="col-span-1 sm:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-tertiary/10 text-tertiary rounded-lg">
                        <FileCheck size={18} />
                     </div>
                     <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado de Validación</p>
                        <p className="text-xs font-bold text-on-surface">Listo para Consolidación</p>
                     </div>
                  </div>
                  <AlertCircle size={18} className="text-slate-200" />
               </div>
            </div>
         )}
      </div>

    </div>
  );
}
