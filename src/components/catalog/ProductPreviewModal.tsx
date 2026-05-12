import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Box, 
  Info, 
  Barcode, 
  DollarSign, 
  Package,
  TrendingUp,
  Tag
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatDate, compareSizes } from '../../utils/format';
import { getCategoryImage } from '../pos/ProductCard';

interface ProductPreviewModalProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: any) => void;
}

export function ProductPreviewModal({ product, isOpen, onClose, onEdit }: ProductPreviewModalProps) {
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      setLoading(true);
      api.getProductVariants(product.id)
        .then(setVariants)
        .catch(err => console.error('Error loading variants:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  // Robust date parsing for creation date
  const creationDate = formatDate(product?.created_at || new Date());


  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.25rem] overflow-hidden shrink-0 bg-white shadow-md border border-slate-100 flex items-center justify-center">
                {product.image ? (
                  <img src={product.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  getCategoryImage(product.category || '', 32)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black font-headline tracking-tighter text-slate-800">{product.name}</h2>
                  <span className="px-3 py-1 bg-primary text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm shadow-primary/20">
                    Vista Previa
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                  <Tag size={10} className="text-primary" /> {product.brand || 'Marca no definida'} • {product.category}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => onEdit(product)}
                className="px-6 h-12 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
              >
                Editar Producto
              </button>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-error transition-all hover:bg-error/5"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 lg:p-10 custom-scrollbar">
            <div className="grid grid-cols-12 gap-8">
              
              {/* Info Sidebar */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Info size={12} className="text-primary" /> Detalles Base
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex flex-col">
                       <span className="text-[9px] font-bold text-slate-400">Barcode Principal</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Barcode size={14} className="text-slate-300" />
                        <span className="text-sm font-mono font-bold text-slate-700">{product.barcode || '---'}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col">
                       <span className="text-[9px] font-bold text-slate-400">Temporada</span>
                      <span className="text-sm font-bold text-slate-700 mt-1">{product.season || 'No definida'}</span>
                    </div>

                    <div className="flex flex-col">
                       <span className="text-[9px] font-bold text-slate-400">Fecha de Ingreso</span>
                      <div className="mt-1">
                        <span className="text-sm font-bold text-slate-700">{creationDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-4">
                  <h3 className="text-[10px] font-black text-primary flex items-center gap-2">
                    <TrendingUp size={12} /> Referencia Comercial
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
                       <span className="text-[9px] font-black text-slate-400">Costo Base</span>
                      <span className="text-lg font-black font-headline italic tracking-tighter text-slate-700">
                        {formatCurrency(product.cost || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-primary text-white p-4 rounded-2xl shadow-xl shadow-primary/20">
                       <span className="text-[9px] font-black opacity-70">PVP Sugerido</span>
                      <span className="text-xl font-black font-headline italic tracking-tighter">
                        {formatCurrency(product.cost || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Matrix */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <div className="flex justify-between items-end">
                   <h3 className="text-[10px] font-black text-slate-500 flex items-center gap-2 ml-2">
                    <Package size={14} className="text-primary" /> Matriz de Existencias
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-[9px] font-bold text-slate-400">Stock OK</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-error/5 rounded-full">
                       <div className="w-1.5 h-1.5 rounded-full bg-error" />
                        <span className="text-[9px] font-bold text-error tracking-tighter">Bajo Stock</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                  {loading ? (
                    <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest animate-pulse">
                      Cargando matriz...
                    </div>
                  ) : variants.length === 0 ? (
                    <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">
                      Sin variantes registradas
                    </div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400">Variante</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400">SKU Interno</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 text-center">Stock Act.</th>
                           <th className="px-6 py-4 text-[10px] font-black text-slate-400 text-right">PVP Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {variants
                            .sort((a, b) => {
                              const colorCompare = a.color.localeCompare(b.color);
                              if (colorCompare !== 0) return colorCompare;
                              return compareSizes(a.size, b.size);
                            })
                            .map((v) => {
                          const isLowStock = v.stock <= (v.stock_minimo || 2);
                          return (
                            <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-black text-slate-700">{v.color}</span>
                                     <span className="text-[10px] font-bold text-primary">Talle {v.size}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                  {v.sku}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-xs ${
                                  isLowStock ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  <Package size={12} />
                                  {v.stock}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-sm font-black text-slate-700 font-headline italic tracking-tighter">
                                  {formatCurrency(v.pvp || product.cost || 0)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Footer Info */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
             <div className="flex items-center gap-2 text-slate-400">
               <Info size={14} />
               <span className="text-[10px] font-medium">Esta vista es de solo lectura. Para modificar existencias, use el módulo de Inventario.</span>
             </div>
             <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
               ARCADIA SYSTEM v2.2
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
