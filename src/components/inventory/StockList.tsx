import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle,
  History,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
  Layers,
  DollarSign, 
  ChevronRight, 
  ArrowUpDown,
  Download,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Zap,
  Trash2,
  RotateCcw,
  Upload
} from 'lucide-react';
import { toast } from '../common/CommonUI';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../../hooks/useInventory';
import { QuickViewDrawer } from './QuickViewDrawer';
import { getCategoryImage } from '../pos/ProductCard';

interface StockListProps {
  products: InventoryItem[];
  loading: boolean;
  updateStock: (variantId: number, quantity: number, type: 'INGRESO' | 'EGRESO', description: string, reason: string) => Promise<void>;
  updateFinancialData: (variantId: number, data: { cost: number; margin: number; price_cash: number; price_debit: number; price_credit: number; description: string; reason: string }) => Promise<void>;
  onFilteredChange?: (filtered: any[]) => void;
  categories: string[];
  brands: string[];
  seasons: string[];
  allColors: string[];
  onAddAttribute: (type: 'categories' | 'brands' | 'seasons' | 'colors', name: string) => Promise<void>;
  onUpdateProduct: (id: number, data: any) => Promise<void>;
  onGetProductById: (id: number) => Promise<any>;
  deletedProducts: InventoryItem[];
  restoreProduct: (id: number) => Promise<void>;
}

export function StockList({ 
  products, 
  loading, 
  updateStock, 
  updateFinancialData, 
  onFilteredChange,
  categories,
  brands,
  seasons,
  allColors,
  onAddAttribute,
  onUpdateProduct,
  onGetProductById,
  deletedProducts,
  restoreProduct
}: StockListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [initialTab, setInitialTab] = useState<'STOCK' | 'FINANCIAL'>('STOCK');

  const [fees] = useState(() => {
    const saved = localStorage.getItem('arcadia_fees');
    return saved ? JSON.parse(saved) : {
      cashDiscount: 0,
      debitSurcharge: 0,
      creditSurcharges: { 1: 0, 3: 0 }
    };
  });

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${name}" y todas sus variantes del catálogo?`)) return;
    try {
      await onUpdateProduct(id, { status: 'deleted' });
      toast.success('Producto eliminado del catálogo');
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar producto');
    }
  };
  
  const [sortBy, setSortBy] = useState('name-asc');
  const [groupBy, setGroupBy] = useState('none');
  const [stockState, setStockState] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Choose source based on whether we are in "Papelera" mode
  const safeProducts = Array.isArray(products) ? products : [];
  const safeDeleted = Array.isArray(deletedProducts) ? deletedProducts : [];
  const sourceProducts = stockState === 'deleted' ? safeDeleted : safeProducts;

  const filteredProducts = useMemo(() => {
    const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t.length > 0);
    
    return sourceProducts.filter(p => {
      // 1. Filter by Stock Status
      let matchesStock = true;
      if (stockState === 'normal') {
        matchesStock = p.stock > p.stock_minimo;
      } else if (stockState === 'low') {
        matchesStock = p.stock > 0 && p.stock <= p.stock_minimo;
      } else if (stockState === 'critical') {
        matchesStock = p.stock <= 0;
      }
      if (!matchesStock) return false;

      // 2. Filter by Search input for real-time filtering
      if (searchTerms.length === 0) return true;
      const searchableString = `${p.name} ${p.sku} ${p.brand} ${p.category} ${p.color} ${p.size}`.toLowerCase();
      return searchTerms.every(term => searchableString.includes(term));
    });
  }, [sourceProducts, searchTerm, stockState]);

  // Pass filtered change event up to refresh summary stats
  useEffect(() => {
    onFilteredChange?.(filteredProducts);
  }, [filteredProducts, onFilteredChange]);



  const groupedProducts = useMemo(() => {
    const groups = new Map<number, any>();
    
    // 1. Initial grouping and totals
    filteredProducts.forEach(p => {
      const pid = p.product_id || 0;
      if (!groups.has(pid)) {
        groups.set(pid, {
          ...p,
          totalStock: 0,
          variantCount: 0,
          variants: [],
          minPvp: Infinity,
          maxPvp: -Infinity,
          inventoryValue: 0,
          hasCustom: false,
          hasCritical: false,
          hasLowStock: false
        });
      }
      const group = groups.get(pid);
      group.totalStock += (p.stock || 0);
      group.variants.push(p);
      if (p.isCustom) group.hasCustom = true;
    });
    
    // 2. Filter variants and refine data
    groups.forEach(group => {
      const hasAnyStock = group.totalStock > 0;
      
      group.variantCount = group.variants.length;
      
      // Calculate derived fields from (possibly filtered) variants
      group.variants.forEach((v: any) => {
        const currentPvp = typeof v.price_cash === 'number' ? v.price_cash : 0;
        group.minPvp = Math.min(group.minPvp, currentPvp);
        group.maxPvp = Math.max(group.maxPvp, currentPvp);
        group.inventoryValue += (v.stock || 0) * currentPvp;
        
        if (v.stock === 0) group.hasCritical = true;
        if (v.stock <= v.stock_minimo && v.stock > 0) group.hasLowStock = true;
      });

      // Special case for all out of stock
      if (group.totalStock <= 0) {
        group.hasCritical = true;
        if (group.minPvp === Infinity) group.minPvp = 0;
        if (group.maxPvp === -Infinity) group.maxPvp = 0;
      }

      // Calculate General Prices for the card using strict hierarchy
      let mEfectivo = 0;
      let mDebit = 0;
      let mCredit = 0;
      
      try {
        const info = typeof group.provider_info === 'string' 
          ? JSON.parse(group.provider_info) 
          : group.provider_info;
        const manual = info?.manual_prices;

        // Hierarchy: Manual -> Base Price -> Calculated fallback (only if no manual at all)
        mEfectivo = manual?.efectivo || group.base_price || group.maxPvp || 0;
        
        // Use user's requested hierarchy for D and C fallbacks
        mDebit = manual?.debito || manual?.efectivo || group.base_price || 0;
        mCredit = manual?.credito || manual?.efectivo || group.base_price || 0;

        // If after manual/base check they are still 0 but we have fees, apply them 
        // ONLY if there was no manual price object at all (to avoid overwriting explicit 0s if they existed)
        if (!manual) {
          if (mDebit === mEfectivo && mEfectivo > 0) {
            mDebit = Math.round(mEfectivo * (1 + (fees.debitSurcharge / 100)));
          }
          if (mCredit === mEfectivo && mEfectivo > 0) {
            mCredit = Math.round(mEfectivo * (1 + ((fees.creditSurcharges?.[1] || 0) / 100)));
          }
        }
      } catch (e) {}
      
      group.generalPrices = { mEfectivo, mDebit, mCredit };
    });
    
    return Array.from(groups.values());
  }, [filteredProducts]);

  // Synchronize selectedProduct when the main products list changes (e.g. after a save)
  useEffect(() => {
    if (selectedProduct) {
      const currentId = Number(selectedProduct.id);
      // Use raw products prop to ensure we always have all variants in the drawer, 
      // ignoring the current filters/search of the list
      const rawVariants = products.filter(p => p.product_id === currentId);
      
      if (rawVariants.length > 0) {
        const base = rawVariants[0];
        setSelectedProduct({
          id: currentId.toString(),
          name: base.name,
          brand: base.brand,
          category: base.category,
          variants: rawVariants,
          totalStock: rawVariants.reduce((sum, v) => sum + (v.stock || 0), 0),
          priceRange: { 
            min: Math.min(...rawVariants.map(v => v.price_cash || 0)), 
            max: Math.max(...rawVariants.map(v => v.price_cash || 0)) 
          }
        });
      }
    }
  }, [products]);


  const sortedGroupedProducts = useMemo(() => {
    return [...groupedProducts].sort((a, b) => {
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (sortBy === 'stock-desc') {
        return b.totalStock - a.totalStock;
      }
      if (sortBy === 'stock-asc') {
        return a.totalStock - b.totalStock;
      }
      if (sortBy === 'price-desc') {
        return b.maxPvp - a.maxPvp;
      }
      if (sortBy === 'price-asc') {
        return a.minPvp - b.minPvp;
      }
      if (sortBy === 'movement-desc' || sortBy === 'created-desc') {
        const maxIdA = Math.max(...a.variants.map((v: any) => v.id || 0));
        const maxIdB = Math.max(...b.variants.map((v: any) => v.id || 0));
        return maxIdB - maxIdA;
      }
      return 0;
    });
  }, [groupedProducts, sortBy]);

  const groupedSections = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'Todos los productos', products: sortedGroupedProducts, totalSkus: sortedGroupedProducts.reduce((acc, p) => acc + p.variantCount, 0) }];
    }
    
    const sections = new Map<string, any>();
    sortedGroupedProducts.forEach(p => {
      let groupKey = 'Sin asignar';
      if (groupBy === 'category') groupKey = p.category || 'Sin categoría';
      if (groupBy === 'brand') groupKey = p.brand || 'Sin marca';
      if (groupBy === 'season') groupKey = p.season || 'Sin temporada';
      
      if (!sections.has(groupKey)) {
        sections.set(groupKey, {
          key: groupKey,
          label: groupKey,
          products: [],
          totalSkus: 0
        });
      }
      
      const sec = sections.get(groupKey);
      if (sec) {
        sec.products.push(p);
        sec.totalSkus += p.variantCount;
      }
    });

    return Array.from(sections.values());
  }, [sortedGroupedProducts, groupBy]);

  const handleExportCSV = () => {
    if (products.length === 0) return;
    
    // Headers
    const headers = ['Nombre', 'SKU', 'Categoria', 'Marca', 'Temporada', 'Color', 'Talle', 'Stock', 'Costo', 'Margen', 'Precio Efectivo', 'Precio Debito', 'Precio Credito'];
    
    // Rows (using filteredProducts to respect current view)
    const rows = filteredProducts.map(p => [
      p.name,
      p.sku,
      p.category,
      p.brand,
      p.season,
      p.color,
      p.size,
      p.stock,
      p.cost,
      p.margin,
      p.price_cash,
      p.price_debit || p.price_cash,
      p.price_credit || p.price_cash
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_arcadia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportación completada');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) {
        toast.error('El archivo CSV está vacío o no es válido');
        return;
      }

      // Detect separator (comma or semicolon)
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';

      // Skip header
      const dataRows = lines.slice(1);
      let successCount = 0;
      let errorCount = 0;

      toast.info(`Procesando ${dataRows.length} artículos...`);

      for (const line of dataRows) {
        try {
          // Robust CSV parser handling quotes and empty fields
          const fields = [];
          let currentField = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
              fields.push(currentField.trim());
              currentField = '';
            } else {
              currentField += char;
            }
          }
          fields.push(currentField.trim());
          
          const cleanFields = fields.map(f => f.replace(/^"|"$/g, '').trim());
          
          if (cleanFields.length < 8) continue;

          // Find product by SKU
          const sku = cleanFields[1];
          const item = products.find(p => p.sku === sku);
          
          if (item) {
            // Update financial data
            await updateFinancialData(item.id, {
              cost: Number(cleanFields[8]) || item.cost,
              margin: Number(cleanFields[9]) || item.margin,
              price_cash: Number(cleanFields[10]) || item.price_cash,
              price_debit: Number(cleanFields[11]) || item.price_debit || 0,
              price_credit: Number(cleanFields[12]) || item.price_credit || 0,
              description: 'Importación masiva por CSV',
              reason: 'INFLACION'
            });
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error('Error importing line:', line, err);
          errorCount++;
        }
      }

      toast.success(`Importación terminada: ${successCount} actualizados, ${errorCount} no encontrados.`);
      e.target.value = ''; // Reset input
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sincronizando Inventario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dynamic filters and sorting bar in single visual row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text"
            placeholder="Buscar por artículo o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-8 py-3.5 bg-slate-50 border border-slate-100/80 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all outline-none shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 px-2 border-r border-slate-100 mr-2">
          <button 
            onClick={handleExportCSV}
            title="Exportar a CSV"
            className="p-3 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <Download size={20} />
          </button>
          <div className="relative">
            <input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleImportCSV}
              title="Importar desde CSV"
            />
            <button 
              className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
              <Upload size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col min-w-[155px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">Ordenar por</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-on-surface hover:border-slate-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none shadow-sm cursor-pointer"
            >
              <option value="name-asc">Nombre A→Z</option>
              <option value="name-desc">Nombre Z→A</option>
              <option value="stock-desc">Mayor stock</option>
              <option value="stock-asc">Menor stock</option>
              <option value="price-desc">Precio mayor</option>
              <option value="price-asc">Precio menor</option>
              <option value="movement-desc">Último movimiento</option>
              <option value="created-desc">Fecha de creación</option>
            </select>
          </div>

          <div className="flex flex-col min-w-[155px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">Agrupación</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-on-surface hover:border-slate-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none shadow-sm cursor-pointer"
            >
              <option value="none">Sin agrupar</option>
              <option value="category">Por categoría/rubro</option>
              <option value="brand">Por marca</option>
              <option value="season">Por temporada</option>
            </select>
          </div>

          <div className="flex flex-col min-w-[155px]">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">Estado de stock</span>
            <select
              value={stockState}
              onChange={(e) => setStockState(e.target.value)}
              className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-on-surface hover:border-slate-200 focus:ring-2 focus:ring-primary/10 transition-all outline-none shadow-sm cursor-pointer"
            >
              <option value="all">Todos</option>
              <option value="normal">Stock normal</option>
              <option value="low">Stock bajo (bajo mínimo)</option>
              <option value="critical">Stock crítico (0 unidades)</option>
              <option value="deleted">Papelera / Eliminados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-emerald-50 to-white p-8 rounded-[2.5rem] border border-emerald-100/50 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Valor de Inventario</p>
             <h3 className="text-3xl font-black text-on-surface italic">
               ${groupedProducts.reduce((acc, p) => acc + p.inventoryValue, 0).toLocaleString()}
             </h3>
             <div className="mt-4 flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase">
                <TrendingUp size={12} />
                <span>Costo Total Activo</span>
             </div>
          </div>
          <div className="absolute right-0 bottom-0 text-emerald-500/10 scale-150 rotate-12 group-hover:scale-175 transition-transform duration-500">
             <TrendingUp size={120} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white p-8 rounded-[2.5rem] border border-blue-100/50 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Total de Unidades</p>
             <h3 className="text-3xl font-black text-on-surface italic">
               {groupedProducts.reduce((acc, p) => acc + p.totalStock, 0)}
             </h3>
             <div className="mt-4 flex items-center gap-2 text-blue-600 font-bold text-[10px] uppercase">
                <Package size={12} />
                <span>En Existencia</span>
             </div>
          </div>
          <div className="absolute right-0 bottom-0 text-blue-500/10 scale-150 -rotate-12 group-hover:scale-175 transition-transform duration-500">
             <Package size={120} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-white p-8 rounded-[2.5rem] border border-slate-100/50 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Variantes Únicas</p>
             <h3 className="text-3xl font-black text-on-surface italic">{filteredProducts.length}</h3>
             <div className="mt-4 flex items-center gap-2 text-slate-600 font-bold text-[10px] uppercase">
                <Layers size={12} />
                <span>SKUs Registrados</span>
             </div>
          </div>
          <div className="absolute right-0 bottom-0 text-slate-500/10 scale-150 rotate-45 group-hover:scale-175 transition-transform duration-500">
             <Layers size={120} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-white p-8 rounded-[2.5rem] border border-rose-100/50 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
             <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Alertas Stock</p>
             <h3 className="text-3xl font-black text-rose-600 italic">
               {filteredProducts.filter(p => p.stock <= p.stock_minimo).length}
             </h3>
             <div className="mt-4 flex items-center gap-2 text-rose-600 font-bold text-[10px] uppercase">
                <ShieldAlert size={12} />
                <span>Atención Requerida</span>
             </div>
          </div>
          <div className="absolute right-0 bottom-0 text-rose-500/10 scale-150 -rotate-12 group-hover:scale-175 transition-transform duration-500">
             <ShieldAlert size={120} />
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="space-y-6">
        {groupedSections.length > 0 && groupedSections.some(s => s.products.length > 0) ? (
          groupedSections.map((section) => {
            const isCollapsed = collapsedGroups[section.key] ?? false;
            if (section.products.length === 0) return null;

            return (
              <div key={section.key} className="space-y-4">
                {groupBy !== 'none' && (
                  <button 
                    onClick={() => setCollapsedGroups(prev => ({ ...prev, [section.key]: !isCollapsed }))}
                    className="w-full flex items-center justify-between bg-white px-8 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm hover:border-slate-200 transition-all text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-on-surface uppercase tracking-tight">{section.label}</span>
                      <span className="px-3 py-1 bg-slate-50 text-[10px] font-black text-slate-400 border border-slate-100 rounded-full group-hover:bg-primary/5 group-hover:text-primary transition-all">
                        {section.totalSkus} SKUs
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: isCollapsed ? 0 : 90 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-400 group-hover:text-primary transition-all"
                    >
                      <ChevronRight size={20} />
                    </motion.div>
                  </button>
                )}

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {section.products.map(product => (
                        <motion.div
                          key={product.product_id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`group bg-white p-6 rounded-[2rem] border shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden cursor-pointer ${
                            product.hasCritical ? 'border-error/30' : 
                            product.hasLowStock ? 'border-warning/30' : 
                            'border-slate-100 hover:border-primary/20'
                          }`}
                          onClick={() => {
                            setInitialTab('STOCK');
                            setSelectedProduct({
                              id: product.product_id.toString(),
                              name: product.name,
                              brand: product.brand,
                              category: product.category,
                              image: product.image,
                              variants: product.variants,
                              totalStock: product.totalStock,
                              priceRange: { min: product.minPvp, max: product.maxPvp }
                            });
                          }}
                        >
                          {/* Left Accent Bar */}
                          <div className={`absolute left-0 top-4 bottom-4 w-1.5 rounded-r-full ${
                            product.hasCritical ? 'bg-error' : 
                            product.hasLowStock ? 'bg-warning' : 
                            'bg-emerald-500'
                          }`} />

                          <div className="flex flex-col lg:flex-row lg:items-center gap-6 relative z-10">
                            {/* Product Info Section */}
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.5rem] overflow-hidden shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center">
                                {product.image ? (
                                  <img src={product.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  getCategoryImage(product.category || '', 32)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mt-1">
                                  <h4 className="font-black text-on-surface uppercase leading-tight text-lg truncate group-hover:text-primary transition-colors">
                                    {product.name}
                                  </h4>
                                  {product.hasCustom && (
                                    <div className="bg-purple-100 text-purple-600 p-1 rounded-md shadow-sm" title="Producto Personalizable">
                                      <Zap size={14} fill="currentColor" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.brand}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</span>
                                  {product.hasCustom && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                                      <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">A Pedido</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status & Variants Section */}
                            <div className="flex flex-wrap items-center gap-4 lg:gap-10">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Disponibilidad</span>
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                                  product.hasCritical ? 'bg-error/10 text-error shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 
                                  product.hasLowStock ? 'bg-warning/10 text-warning' : 
                                  'bg-emerald-500/10 text-emerald-600'
                                }`}>
                                  {product.hasCritical ? (
                                    <motion.div
                                      animate={{ scale: [1, 1.2, 1] }}
                                      transition={{ repeat: Infinity, duration: 2 }}
                                    >
                                      <ShieldAlert size={14} className="shrink-0" />
                                    </motion.div>
                                  ) : product.hasLowStock ? (
                                    <AlertTriangle size={14} className="shrink-0" />
                                  ) : (
                                    <CheckCircle2 size={14} className="shrink-0" />
                                  )}
                                  
                                  <div className="flex flex-col leading-none">
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                      {product.totalStock} Unidades
                                    </span>
                                    <span className="text-[8px] font-bold uppercase opacity-70 tracking-tighter mt-0.5">
                                      {product.totalStock === 0 ? 'Agotado' : product.hasCritical ? 'Crítico' : product.hasLowStock ? 'Stock Bajo' : 'Saludable'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Variantes</span>
                                <div className="flex items-center gap-1">
                                  <div className="px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                                    <span className="text-[10px] font-black text-on-surface uppercase tracking-wider">
                                      {product.variantCount} SKUs
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Price & Action Section */}
                            <div className="flex items-center justify-between lg:justify-end lg:gap-10 border-t lg:border-t-0 border-slate-50 pt-4 lg:pt-0">
                              <div className="text-left lg:text-right">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Precios Generales</span>
                                <div className="flex flex-col lg:items-end gap-0.5">
                                  <p className="text-xl font-black text-on-surface">
                                    <span className="text-[10px] text-slate-400 mr-1 uppercase">E:</span>
                                    ${(product.generalPrices?.mEfectivo || 0).toLocaleString()}
                                  </p>
                                  <div className="flex gap-3">
                                    <p className="text-[11px] font-bold text-slate-400">
                                      <span className="text-[9px] text-slate-300 mr-1 uppercase font-black">D:</span>
                                      ${(product.generalPrices?.mDebit || 0).toLocaleString()}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-400">
                                      <span className="text-[9px] text-slate-300 mr-1 uppercase font-black">C:</span>
                                      ${(product.generalPrices?.mCredit || 0).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-3">
                                {stockState === 'deleted' ? (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      restoreProduct(product.product_id);
                                    }}
                                    className="w-full px-6 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition-all shadow-sm font-black uppercase text-[10px] tracking-widest"
                                  >
                                    <RotateCcw size={18} /> Restaurar Producto
                                  </button>
                                ) : (
                                  <>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteProduct(product.product_id, product.name);
                                      }}
                                      className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:scale-105 active:scale-95 transition-all shadow-sm"
                                      title="Eliminar del catálogo"
                                    >
                                      <Trash2 size={24} />
                                    </button>
                                    
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInitialTab('FINANCIAL');
                                        setSelectedProduct({
                                          id: product.product_id.toString(),
                                          name: product.name,
                                          brand: product.brand,
                                          category: product.category,
                                          variants: product.variants,
                                          totalStock: product.totalStock,
                                          priceRange: { min: product.minPvp, max: product.maxPvp }
                                        });
                                      }}
                                      className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-primary hover:text-white hover:scale-105 active:scale-95 transition-all shadow-sm group-hover:shadow-md"
                                      title="Ajuste financiero"
                                    >
                                      <DollarSign size={24} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-slate-100 shadow-sm"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 text-slate-200">
              <Search size={40} />
            </div>
            <h3 className="text-xl font-black text-on-surface uppercase tracking-tight mb-2">
              {products.length === 0 ? 'El inventario está vacío' : 'No se encontraron resultados'}
            </h3>
            <p className="text-slate-400 text-sm font-medium max-w-xs text-center leading-relaxed">
              {products.length === 0 
                ? 'Comienza agregando nuevos productos al sistema.' 
                : 'No hay coincidencias para tus filtros. Intenta con otros términos.'}
            </p>
            {products.length > 0 && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSortBy('name-asc');
                  setGroupBy('none');
                  setStockState('all');
                }}
                className="mt-8 px-8 py-4 bg-on-surface text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-lg active:scale-95"
              >
                Limpiar Filtros
              </button>
            )}
          </motion.div>
        )}
      </div>

      <QuickViewDrawer 
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSaveStock={updateStock}
        onSaveFinancial={updateFinancialData}
        initialTab={initialTab}
        allColors={allColors}
        categories={categories}
        brands={brands}
        seasons={seasons}
        onAddAttribute={onAddAttribute}
        onUpdateProduct={onUpdateProduct}
        onGetProductById={onGetProductById}
      />
    </div>
  );
}
