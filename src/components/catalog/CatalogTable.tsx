import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Edit3, 
  Eye,
  X,
  Package,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../services/api';
import { toast, formatCurrency } from '../common/CommonUI';
import { ProductDetailDrawer } from './ProductDetailDrawer';
import { calculatePVP, IVA_DEFAULT } from '../../utils/pricing';
import { getCategoryImage } from '../pos/ProductCard';

export function CatalogTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAllProducts();
      setProducts(data);
    } catch (error) {
      toast.error('Error al cargar catálogo');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);


  const filteredProducts = products.filter(p => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    
    // Check for exact SKU match or name/brand/category
    const hasSkuMatch = p.skus?.toLowerCase().includes(search);
    
    return (
      (p.name?.toLowerCase().includes(search)) ||
      (p.brand?.toLowerCase().includes(search)) ||
      (p.category?.toLowerCase().includes(search)) ||
      hasSkuMatch
    );
  });

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface uppercase">Catálogo Maestro</h2>
          <p className="text-secondary font-medium mt-1">Inventario centralizado de Activos y SKUs validados.</p>
        </div>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'product-new' }))}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Package size={18} />
          <span>Nuevo Producto</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
          <input 
            className="w-full h-12 pl-12 pr-12 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
            placeholder="Buscar por Nombre, Marca o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 transition-all"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button className="w-full md:w-auto h-12 px-6 flex items-center justify-center gap-2 bg-slate-50 text-slate-500 font-bold rounded-2xl hover:bg-slate-100 transition-all text-xs uppercase tracking-widest">
          <Filter size={16} />
          <span>Filtros</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Producto</th>
              <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Barcode</th>
              <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Categoría</th>
              <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Stock</th>
              <th className="py-5 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Precio Ref.</th>
              <th className="py-5 px-8 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
               <tr><td colSpan={6} className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest">Cargando catálogo...</td></tr>
            ) : filteredProducts.length === 0 ? (
               <tr><td colSpan={6} className="p-10 text-center text-slate-300 font-bold uppercase tracking-widest">No se encontraron productos</td></tr>
            ) : filteredProducts.map((p) => {
              const totalStock = p.total_stock || 0;
              const totalMinStock = p.total_stock_minimo || 5; // Fallback to 5 if not set
              const isOutOfStock = totalStock <= 0;
              const isLowStock = totalStock <= totalMinStock && !isOutOfStock;

              return (
                <tr 
                  key={p.id} 
                  className={`group hover:bg-slate-50/80 transition-all cursor-pointer ${
                    isOutOfStock ? 'bg-error/[0.08]' : isLowStock ? 'bg-warning/[0.08]' : ''
                  }`}
                  onClick={() => {
                    setPreviewProduct(p);
                    setIsPreviewOpen(true);
                  }}
                >
                  <td className="py-5 px-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getCategoryImage(p.category || '', 24)
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors">{p.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{p.brand || 'Marca no definida'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-8">
                    <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                      {p.barcode || '---'}
                    </span>
                  </td>
                  <td className="py-5 px-8">
                    <span className="px-2 py-0.5 bg-blue-50 text-primary text-[9px] font-black rounded uppercase">{p.category}</span>
                  </td>
                   <td 
                    className="py-5 px-8 text-center cursor-pointer hover:bg-slate-100/50 transition-colors group/stock"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'product-new', product: p } }));
                    }}
                    title="Gestionar Stock"
                   >
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 group-hover/stock:scale-110 transition-transform">
                          <span className={`text-base font-black italic font-headline tracking-tighter ${
                            isOutOfStock ? 'text-error' : isLowStock ? 'text-warning' : 'text-slate-600'
                          }`}>
                            {totalStock}
                          </span>
                          <span className="text-[10px] font-bold text-slate-300">/</span>
                          <span className="text-[10px] font-bold text-slate-400">{totalMinStock}</span>
                        </div>
                        {isOutOfStock ? (
                          <span className="text-[8px] font-black text-error uppercase tracking-tight flex items-center gap-1 mt-0.5">
                            <AlertCircle size={8} /> Sin Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[8px] font-black text-warning uppercase tracking-tight flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={8} /> Reponer
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Stock OK</span>
                        )}
                      </div>
                   </td>
                  <td className="py-5 px-8 text-right">
                    <span className="text-base font-black text-on-surface font-headline italic tracking-tighter">
                      {formatCurrency(calculatePVP(p.cost || 0, p.base_margin || 60, p.iva_rate || IVA_DEFAULT))}
                    </span>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">PVP Sugerido</p>
                  </td>
                  <td className="py-5 px-8 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setPreviewProduct(p);
                          setIsPreviewOpen(true);
                        }}
                        className="p-2.5 bg-white shadow-sm border border-slate-100 rounded-xl text-slate-400 hover:text-primary hover:border-primary/20 transition-all"
                        title="Vista Rápida"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'product-new', product: p } })); }}
                        className="p-2.5 bg-white shadow-sm border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 hover:border-slate-900/20 transition-all"
                        title="Editar Metadatos"
                      >
                        <Edit3 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
     </div>
      
      <ProductDetailDrawer 
        isOpen={isPreviewOpen}
        product={previewProduct}
        onClose={() => setIsPreviewOpen(false)}
        onEdit={(p) => {
          setIsPreviewOpen(false);
          window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'product-new', product: p } }));
        }}
      />
    </div>
  );
}
