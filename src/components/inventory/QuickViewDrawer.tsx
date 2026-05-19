import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../services/api';
import { 
  X, 
  TrendingUp, 
  Shirt,
  CheckCircle2, 
  DollarSign,
  Plus,
  Minus,
  ArrowLeft,
  PackagePlus,
  RotateCcw,
  PlusCircle,
  MinusCircle,
  Trash2,
  ShieldAlert,
  MessageSquare,
  Keyboard,
  Calendar,
  Tag,
  AlertCircle
} from 'lucide-react';
import { InventoryItem } from '../../hooks/useInventory';
import { Button, toast } from '../common/CommonUI';
import { calculatePVP, calculateMargin } from '../../utils/pricing';
import { useOperator } from '../../context/OperatorContext';
import { isUUID } from '../../utils/validation';


// Utility for smart size sorting
const compareSizes = (a: string, b: string) => {
  const sizeOrder: Record<string, number> = {
    'XXXS': 1, 'XXS': 2, 'XS': 3, 'S': 4, 'M': 5, 'L': 6, 'XL': 7, 'XXL': 8, 'XXXL': 9,
    'U': 100, 'UNICO': 100, 'ÚNICO': 100
  };
  
  const aUpper = a.toUpperCase();
  const bUpper = b.toUpperCase();
  
  if (sizeOrder[aUpper] !== undefined && sizeOrder[bUpper] !== undefined) {
    return sizeOrder[aUpper] - sizeOrder[bUpper];
  }
  
  // Try numeric comparison (handles "38", "38/40", etc)
  const aNum = parseFloat(a.split('/')[0].replace(/[^0-9.]/g, ''));
  const bNum = parseFloat(b.split('/')[0].replace(/[^0-9.]/g, ''));
  
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }
  
  return a.localeCompare(b);
};

interface QuickViewDrawerProps {
  product: {
    id: string;
    variant_id?: string;
    name: string;
    brand: string;
    category: string;
    image?: string;
    variants: InventoryItem[];
    totalStock: number;
    priceRange: { min: number; max: number };
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveStock: (variantId: string, quantity: number, type: 'INGRESO' | 'EGRESO', description: string, reason: string) => Promise<void>;
  onSaveFinancial?: (variantId: string, data: any) => Promise<void>;
  initialTab?: 'STOCK' | 'FINANCIAL';
  allColors?: string[];
  onFilteredChange?: (filtered: any[]) => void;
  categories?: string[];
  brands?: string[];
  seasons?: string[];
  onAddAttribute?: (type: 'categories' | 'brands' | 'seasons' | 'colors', name: string) => Promise<void>;
  onUpdateProduct: (id: string, data: any) => Promise<void>;
  onGetProductById: (id: string) => Promise<any>;
  providers?: string[];
  deletedProducts?: InventoryItem[];
  restoreProduct?: (id: string) => Promise<void>;
}

const STOCK_REASONS_POSITIVE = [
  { id: 'INGRESO', label: 'Ingreso', icon: PackagePlus, color: 'text-tertiary' },
  { id: 'DEVOLUCION', label: 'Devolución', icon: RotateCcw, color: 'text-tertiary' },
  { id: 'AJUSTE_POS', label: 'Ajuste (+)', icon: PlusCircle, color: 'text-tertiary' },
];

const STOCK_REASONS_NEGATIVE = [
  { id: 'ROTURA', label: 'Rotura', icon: Trash2, color: 'text-error' },
  { id: 'ROBO', label: 'Robo', icon: ShieldAlert, color: 'text-error' },
  { id: 'AJUSTE_NEG', label: 'Ajuste (-)', icon: MinusCircle, color: 'text-error' },
];

const FINANCIAL_REASONS = [
  { id: 'INFLACION', label: 'Inflación', icon: TrendingUp, color: 'text-primary' },
  { id: 'LIQUIDACION', label: 'Liquidación', icon: Tag, color: 'text-error' },
  { id: 'ERROR_TIPEO', label: 'Error de Tipeo', icon: Keyboard, color: 'text-slate-400' },
  { id: 'CAMBIO_TEMP', label: 'Cambio Temporada', icon: Calendar, color: 'text-primary' },
];

export function QuickViewDrawer({ 
  product, 
  isOpen, 
  onClose, 
  onSaveStock, 
  initialTab,
  onUpdateProduct,
  onGetProductById,
  brands = [],
  categories = []
}: QuickViewDrawerProps) {
  const [activeTab, setActiveTab] = useState<'STOCK' | 'FINANCIAL' | 'PRODUCT'>(initialTab || 'STOCK');
  const [view, setView] = useState<'MATRIX' | 'ADJUST'>('MATRIX');
  const [selectedVariant, setSelectedVariant] = useState<InventoryItem | null>(null);
  const [localProduct, setLocalProduct] = useState<any>(product);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const { operatorName } = useOperator();

  // Sync localProduct with product prop
  useEffect(() => {
    setLocalProduct(product);
  }, [product]);
  
  // Stock Adjustment State
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  
  // Financial Adjustment State
  const [cost, setCost] = useState(0);
  const [margin, setMargin] = useState(0);
  const [priceCash, setPriceCash] = useState(0);
  const [priceDebit, setPriceDebit] = useState(0);
  const [priceCredit, setPriceCredit] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [financialReason, setFinancialReason] = useState('');
  const [financialDescription, setFinancialDescription] = useState('');
  
  const [fees] = useState(() => {
    const saved = localStorage.getItem('arcadia_fees');
    return saved ? JSON.parse(saved) : {
      cashDiscount: 0,
      debitSurcharge: 0,
      creditSurcharges: { 1: 0, 3: 0 }
    };
  });
  
  // Product Edit State
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editProvider, setEditProvider] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  // Initial tab sync
  useEffect(() => {
      if (!isOpen || !product) return;

      const productId = product.id;
      
      // FIX: Strict guard for productId
      if (!productId || productId === 'undefined' || productId === 'null' || productId === '0') {
          console.error("[QuickViewDrawer] CRITICAL: Missing or invalid productId", { product });
          toast.error("Error: El producto no tiene un ID válido.");
          onClose(); // Auto-close if invalid
          return;
      }

      // Initialize edit fields
      setEditName(product.name || '');
      setEditBrand(product.brand || '');
      setEditCategory(product.category || '');
      
      onGetProductById(productId).then(full => {
        if (full) {
          setLocalProduct(full);
          setEditProvider(full.provider_info || '');
          // Keep other fields in sync if they changed
          setEditName(full.name || '');
          setEditBrand(full.brand || '');
          setEditCategory(full.category || '');
        }
      }).catch(err => {
        console.error("[QuickViewDrawer] Error fetching product:", productId, err);
        toast.error("No se pudo cargar el detalle del producto");
      });
  }, [isOpen, initialTab, product?.id]);

  // Sync financial values when variant selected or cost/margin changes
  useEffect(() => {
    if (selectedVariant) {
      if (view === 'ADJUST') {
        setPriceCash(selectedVariant.priceCash || 0);
        setPriceDebit(selectedVariant.priceDebit || 0);
        setPriceCredit(selectedVariant.priceCredit || 0);
        setCost(selectedVariant.cost || 0);
        setMargin(selectedVariant.margin || 0);
        setAdjustmentValue(0);
        setSelectedReason('');
        setDescription('');
        setFinancialReason('');
        setFinancialDescription('');

        // Try to load manual prices from provider_info or calculate fallback
        let manualEfectivo = selectedVariant.priceCash || 0;
        let manualDebit = 0;
        let manualCredit = 0;
        
        try {
          const rawInfo = (selectedVariant as any).provider_info || localProduct?.provider_info;
          console.log("Datos recibidos en Drawer (raw):", rawInfo);

          // Skip if it's the known corrupt string "[object Object]"
          if (rawInfo && String(rawInfo) !== "[object Object]") {
            const info = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
            console.log("Datos recibidos en Drawer (parsed):", info);
            
            const prices = info?.manual_prices;
            if (prices) {
              manualEfectivo = Number(prices.efectivo) || manualEfectivo;
              manualDebit = Number(prices.debito || prices.debit) || 0;
              manualCredit = Number(prices.credito || prices.credit) || 0;
            }
          }
        } catch (e) {
          console.error("Error parsing provider_info in Drawer:", e);
        }

        setPriceCash(manualEfectivo);
        // STRICT HIERARCHY: manual -> priceCash -> 0
        setPriceDebit(manualDebit || manualEfectivo || 0);
        setPriceCredit(manualCredit || manualEfectivo || 0);
      }
    }
  }, [selectedVariant, view, fees, localProduct]);

  const globalPrices = useMemo(() => {
    let mDebit = 0;
    let mCredit = 0;
    
    // Use priceCash if available (from REST), fallback to base_price (from Supabase)
    let mEfectivo = localProduct?.priceCash || localProduct?.base_price || 0;
    if (!mEfectivo && localProduct?.variants?.length > 0) {
      mEfectivo = Math.max(...localProduct.variants.map((v: any) => v.priceCash || v.pvp || 0));
    }
    
    try {
      const rawInfo = localProduct?.provider_info;
      if (rawInfo && String(rawInfo) !== "[object Object]") {
        const info = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
        if (info?.manual_prices) {
          if (info.manual_prices.efectivo) mEfectivo = Number(info.manual_prices.efectivo);
          mDebit = Number(info.manual_prices.debito || info.manual_prices.debit) || 0;
          mCredit = Number(info.manual_prices.credito || info.manual_prices.credit) || 0;
        }
      }
    } catch (e) {}
    
    // Fallbacks if 0 or missing
    if (!mDebit) mDebit = Math.round(mEfectivo * (1 + (fees.debitSurcharge / 100)));
    if (!mCredit) mCredit = Math.round(mEfectivo * (1 + ((fees.creditSurcharges?.[1] || 0) / 100)));
    
    return { mDebit, mCredit, mEfectivo };
  }, [localProduct, fees]);

  // Sync general prices for inline editing - ONLY when starting to edit
  useEffect(() => {
    if (isEditingGeneral) {
      setPriceCash(globalPrices.mEfectivo);
      setPriceDebit(globalPrices.mDebit);
      setPriceCredit(globalPrices.mCredit);
      setFinancialReason('INFLACION');
      
      // Also set cost/margin from first variant if possible
      if (localProduct?.variants?.length > 0) {
        const first = localProduct.variants[0];
        setCost(first.cost || 0);
        setMargin(first.margin || 0);
      }
    }
  }, [isEditingGeneral]); // Removed globalPrices and localProduct from dependencies

  // Reset selected reason if it's not valid for the current adjustment sign
  useEffect(() => {
    if (activeTab === 'STOCK') {
      const currentReasons = adjustmentValue >= 0 ? STOCK_REASONS_POSITIVE : STOCK_REASONS_NEGATIVE;
      if (selectedReason && !currentReasons.find(r => r.id === selectedReason)) {
        setSelectedReason('');
      }
    }
  }, [adjustmentValue, selectedReason, activeTab]);

  useEffect(() => {
    if (activeTab === 'FINANCIAL' && view === 'ADJUST') {
      const calculatedPvp = cost * (1 + margin / 100);
      setPriceCash(Math.round(calculatedPvp));
    }
  }, [cost, margin, activeTab, view]);

  const [sessionColors] = useState<string[]>([]);
  const [sessionSizes] = useState<string[]>([]);

  // Matrix Calculations
  const matrixData = useMemo(() => {
    if (!localProduct) return { colors: [], sizes: [], grid: new Map() };
    const safeVariants = Array.isArray(localProduct.variants) ? localProduct.variants : [];
    // Mix current product colors/sizes with any new ones added in this session
    const colors = Array.from(new Set([
      ...safeVariants.map((v: any) => v.color || 'N/A'),
      ...sessionColors
    ])).sort((a, b) => (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' }));
    
    const sizes = Array.from(new Set([
      ...safeVariants.map((v: any) => v.size || 'N/A'),
      ...sessionSizes
    ])).sort(compareSizes);
    
    const grid = new Map();
    safeVariants.forEach((v: any) => {
      grid.set(`${v.color || 'N/A'}-${v.size || 'N/A'}`, v);
    });
    
    return { colors, sizes, grid };
  }, [localProduct, sessionColors, sessionSizes]);

  // State for adding new attributes (not currently used in drawer)

  const handleAddVariant = async (color: string, size: string) => {
    if (!product) return;
    setIsSaving(true);
    try {
      // Fetch full product details to ensure we have all fields for the update RPC
      const fullProduct = await onGetProductById(product.id);
      if (!fullProduct) throw new Error("No se pudo obtener la información del producto");

      // 0. Check if variant already exists (might be hidden because of 0 stock)
      const existing = fullProduct.variants.find((v: any) => v.color === color && v.size === size);
      if (existing) {
        // Just redirect to adjustment view for the existing variant
        openAdjustment({
          ...existing,
          isCustom: existing.is_custom
        });
        return;
      }

      // 1. Generate unique SKU
      const rubro = (fullProduct.category || 'GEN').substring(0, 3).toUpperCase().padEnd(3, 'X');
      const col = (color || 'XXX').substring(0, 3).toUpperCase().padEnd(3, 'X');
      const tal = (size || 'UNI');
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newSku = `${rubro}-${col}-${tal}-${suffix}`;

      // 2. Prepare payload (updateProduct expects all variants)
      const currentVariants = fullProduct.variants.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        stock: v.stock,
        stockMinimo: v.stockMinimo,
        cost: v.cost,
        margin: v.margin,
        priceCash: v.priceCash,
        isCustom: v.is_custom
      }));

      const newPvp = calculatePVP(fullProduct.cost || 0, fullProduct.base_margin || 60, fullProduct.iva_rate || 21);

      const newVariant = {
        sku: newSku,
        size,
        color,
        stock: 0,
        stockMinimo: fullProduct.stockMinimo || 5,
        cost: fullProduct.cost || 0,
        margin: fullProduct.base_margin || 60,
        priceCash: newPvp,
        isCustom: false
      };

      const payload = {
        name: fullProduct.name,
        category: fullProduct.category,
        brand: fullProduct.brand,
        season: fullProduct.season || '',
        barcode: fullProduct.barcode,
        ivaRate: fullProduct.ivaRate || 21,
        cost: fullProduct.cost || 0,
        baseMargin: fullProduct.baseMargin || 60,
        stockMinimo: fullProduct.stockMinimo || 5,
        providerInfo: fullProduct.providerInfo || '',
        status: fullProduct.status || 'active',
        basePrice: fullProduct.basePrice || 0,
        lastOperator: operatorName || 'Sistema',
        variants: [...currentVariants, newVariant]
      };

      await onUpdateProduct(String(product.id), payload);
      
      // Refresh local product data immediately
      const updated = await onGetProductById(String(product.id));
      if (updated) {
        setLocalProduct(updated);
      }

      toast.success(`Variante ${color} - ${size} creada`);
    } catch (error) {
      console.error(error);
      toast.error("Error al crear variante");
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  const handleStockAction = async () => {
    if (!selectedVariant || adjustmentValue === 0 || !selectedReason) return;
    setIsSaving(true);
    try {
      const type = adjustmentValue > 0 ? 'INGRESO' : 'EGRESO';
      await onSaveStock(selectedVariant.id, adjustmentValue, type, description, selectedReason);
      
      // Refresh local product data
      const updated = await onGetProductById(product.id);
      if (updated) setLocalProduct({
        ...product,
        variants: updated.variants
      });

      setView('MATRIX');
      setSelectedVariant(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinancialAction = async () => {
    const targetVariant = isEditingGeneral ? localProduct?.variants?.[0] : selectedVariant;
    if (!targetVariant && !localProduct) return;
    
    const productId = localProduct?.id || localProduct?.variant_id || (targetVariant as any)?.productId;
    const financialUpdateReason = financialReason || 'INFLACION';

    try {
      if (!isUUID(productId)) throw new Error('Product ID inválido');
      if (!Number.isFinite(Number(priceCash)) || Number(priceCash) <= 0) {
        throw new Error('Precio de Efectivo inválido');
      }
      
      setIsUpdating(true);
      const updatedProduct = await api.unifiedProductUpdate(productId!, {
        basePrice: Number(priceCash),
        cost: Number(cost),
        baseMargin: Number(margin),
        providerInfo: {
          manual_prices: {
            efectivo: Number(priceCash),
            debito: Number(priceDebit),
            credito: Number(priceCredit)
          }
        },
        updateReason: financialUpdateReason,
        operatorId: '0'
      });

      setLocalProduct(updatedProduct);
      toast.success('Precios actualizados');
      setIsEditingGeneral(false);
      setView('MATRIX');
      setSelectedVariant(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const openAdjustment = (variant: InventoryItem) => {
    setSelectedVariant(variant);
    setView('ADJUST');
  };

  const handleProductUpdate = async () => {
    if (!localProduct) return;
    setIsSaving(true);
    try {
      await onUpdateProduct(String(localProduct.id), {
        name: editName,
        brand: editBrand,
        category: editCategory,
        provider_info: editProvider
      });
      toast.success('Producto actualizado');
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && localProduct && (
        <div className="fixed inset-0 z-[999] flex justify-end overflow-hidden">
          {/* Backdrop with higher blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/10 backdrop-blur-[16px] pointer-events-auto"
          />

          {/* Drawer - width fixed to 520px */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="relative w-full max-w-[520px] bg-white h-full shadow-[-20px_0_60px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden rounded-l-[32px]"
          >
            {(!localProduct?.id || localProduct.id === 'undefined') && (
              <div className="absolute inset-0 z-[1000] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-12 text-center">
                 <AlertCircle size={64} className="text-error mb-6" />
                 <h2 className="text-2xl font-black text-slate-800 mb-4 uppercase">Error de Identidad</h2>
                 <p className="text-slate-500 font-bold mb-8">Este producto no posee un UUID válido. No es posible realizar ajustes hasta que se complete la sincronización del catálogo.</p>
                 <Button onClick={onClose} className="bg-slate-900 text-white px-12 h-14 rounded-2xl">Entendido</Button>
              </div>
            )}
            {/* Premium Header (Image 4) */}
            <div className="p-8 pt-12 pb-6 flex items-start justify-between relative shrink-0">
              <div className="flex items-center gap-5">
                {view === 'ADJUST' && (
                  <button 
                    onClick={() => { setView('MATRIX'); setSelectedVariant(null); }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-primary transition-all border border-slate-100 shadow-sm"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div className="w-[60px] h-[60px] rounded-[20px] bg-[#f1f5f9] flex items-center justify-center text-slate-700 shadow-sm shrink-0">
                  <Shirt size={32} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-[22px] font-black text-[#1a1a2e] tracking-tight leading-none mb-2">{localProduct.name}</h2>
                  <p className="text-[11px] font-bold text-[#8892a4] uppercase tracking-widest flex items-center gap-2">
                    <span className="text-primary">+</span> {localProduct.category || 'GENERAL'} <span className="opacity-30">•</span> {localProduct.barcode || 'SKU-0000'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                 <div className="text-right">
                    <p className="text-[10px] font-black text-[#8892a4] uppercase tracking-widest mb-1">Stock Total</p>
                    <div className="flex items-end justify-end gap-1.5">
                      <span className="text-[42px] font-black text-[#1a1a2e] leading-none tracking-tighter">{localProduct.totalStock}</span>
                      <span className="text-[14px] font-bold text-[#8892a4] mb-1.5 italic">u.</span>
                    </div>
                 </div>
                 <button 
                  onClick={onClose}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#f8fafc] text-slate-300 hover:text-slate-500 transition-all border border-slate-100 shadow-sm hover:shadow-md"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {view === 'MATRIX' && (
              <div className="px-8 mb-4">
                <div className="flex gap-10 border-b border-slate-100 relative">
                  {(['STOCK', 'FINANCIAL', 'PRODUCT'] as const).map((tab) => {
                    const isActive = activeTab === tab;
                    const label = tab === 'STOCK' ? 'STOCK' : tab === 'FINANCIAL' ? 'FINANZAS' : 'PRODUCTO';
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`relative pb-4 flex items-center gap-2.5 text-[12px] font-black tracking-wide transition-all ${
                          isActive 
                            ? 'text-[#1a1a2e]' 
                            : 'text-[#94a3b8] hover:text-[#515f74]'
                        }`}
                      >
                        <span className="uppercase">{label}</span>
                        {isActive && (
                          <motion.div 
                            layoutId="activeTabUnderlineQuick"
                            className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-full"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30">
              <AnimatePresence mode="wait">
                {activeTab === 'PRODUCT' ? (
                  <motion.div 
                    key="product-edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 lg:p-8 space-y-8"
                  >
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Nombre del Producto</label>
                        <input 
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full h-14 bg-white border border-slate-100 rounded-2xl px-6 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none shadow-sm transition-all"
                          placeholder="Nombre comercial..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Marca</label>
                          <select 
                              value={editBrand}
                              onChange={(e) => setEditBrand(e.target.value)}
                              className="w-full h-14 bg-white border border-slate-100 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none shadow-sm appearance-none"
                            >
                              {Array.isArray(brands) && brands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Tipo de Indumentaria</label>
                          <select 
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="w-full h-14 bg-white border border-slate-100 rounded-2xl px-4 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none shadow-sm appearance-none"
                            >
                              {Array.isArray(categories) && categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Proveedor / Info Extra</label>
                        <textarea 
                          value={editProvider}
                          onChange={(e) => setEditProvider(e.target.value)}
                          className="w-full h-32 bg-white border border-slate-100 rounded-2xl p-6 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none shadow-sm resize-none transition-all"
                          placeholder="Nombre del proveedor, contacto, notas de fábrica..."
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleProductUpdate}
                        disabled={isSaving}
                        className="w-full py-5 bg-on-surface text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:bg-primary transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {isSaving ? <RotateCcw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        Guardar Cambios
                      </button>
                    </div>
                  </motion.div>
                ) : (activeTab === 'STOCK' && !selectedVariant) ? (
                  <motion.div 
                    key="matrix"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 lg:p-8"
                  >
                    <div className="grid grid-cols-3 gap-4 mb-8">
                       <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
                          <span className="text-[10px] font-black text-[#15803d] uppercase tracking-wider">Óptimo</span>
                          <span className="text-[28px] font-black text-[#166534] leading-tight">{localProduct.variants.filter((v:any) => v.stock > 5).reduce((acc:any, v:any) => acc + v.stock, 0)}</span>
                       </div>
                       <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
                          <span className="text-[10px] font-black text-[#b45309] uppercase tracking-wider">Bajo</span>
                          <span className="text-[28px] font-black text-[#92400e] leading-tight">{localProduct.variants.filter((v:any) => v.stock > 0 && v.stock <= 5).reduce((acc:any, v:any) => acc + v.stock, 0)}</span>
                       </div>
                       <div className="bg-[#fef2f2] border border-[#fee2e2] rounded-2xl p-5 flex flex-col gap-1.5 shadow-sm">
                          <span className="text-[10px] font-black text-[#b91c1c] uppercase tracking-wider">Crítico</span>
                          <span className="text-[28px] font-black text-[#991b1b] leading-tight">{localProduct.variants.filter((v:any) => v.stock <= 0).length}</span>
                       </div>
                    </div>

                    <div className="bg-white rounded-[24px] border border-[#f1f5f9] shadow-sm overflow-hidden overflow-x-auto mb-8">
                      <table className="w-full text-center border-collapse">
                        <thead>
                          <tr className="bg-[#f8fafc] border-b border-[#f1f5f9]">
                            <th className="p-5 text-left text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">
                              <span>Color / Talle</span>
                            </th>
                            {matrixData.sizes.map(size => (
                              <th key={size} className="p-5 text-center text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">{size}</th>
                            ))}
                            <th className="p-5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f8fafc]">
                          {matrixData.colors.map((color, idx) => (
                            <tr key={color} className="group hover:bg-[#f8fafc]/50 transition-colors">
                              <td className="p-5 text-left flex items-center gap-4">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ['#1e3a5f', '#1a1a2e', '#e53e3e', '#38a169'][idx % 4] }} />
                                <span className="text-[12px] font-bold text-[#1a1a2e] uppercase tracking-tight">{color}</span>
                              </td>
                              {matrixData.sizes.map(size => {
                                const variant = matrixData.grid.get(`${color}-${size}`);
                                if (!variant) return <td key={size} className="p-2"><button onClick={() => handleAddVariant(color, size)} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-100 text-slate-200"><Plus size={14} /></button></td>;
                                
                                const stockVal = variant.stock;
                                let bg = 'bg-slate-50', fg = 'text-slate-300', border = 'border-slate-100';
                                if (activeTab === 'STOCK') {
                                  if (stockVal > 5) { bg = 'bg-[#f0fdf4]'; fg = 'text-[#22c55e]'; border = 'border-[#dcfce7]'; }
                                  else if (stockVal > 0) { bg = 'bg-[#fffbeb]'; fg = 'text-[#f59e0b]'; border = 'border-[#fef3c7]'; }
                                  else if (stockVal <= 0) { bg = 'bg-[#fef2f2]'; fg = 'text-[#ef4444]'; border = 'border-[#fee2e2]'; }
                                } else { bg = 'bg-[#f0f7ff]'; fg = 'text-[#3b82f6]'; border = 'border-[#dbeafe]'; }

                                return (
                                  <td key={size} className="p-2">
                                    <button onClick={() => openAdjustment(variant)} className={`w-[48px] h-[48px] mx-auto rounded-[16px] border flex flex-col items-center justify-center gap-0.5 transition-all ${bg} ${fg} ${border} hover:scale-105 active:scale-95 shadow-sm`}>
                                      <span className="text-[15px] font-black leading-none">{activeTab === 'STOCK' ? stockVal : '$'}</span>
                                      <span className="text-[9px] font-bold opacity-60">{activeTab === 'STOCK' ? 'u.' : 'aj.'}</span>
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="p-2" />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button 
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('navigate', { 
                          detail: { tab: 'product-new', product: localProduct } 
                        }));
                        onClose();
                      }}
                      className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center gap-3 text-slate-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all group shrink-0"
                    >
                      <Plus size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[13px] font-black uppercase tracking-widest">Agregar variante o ajustar stock</span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="adjust"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-6 lg:p-8 space-y-8"
                  >
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-center gap-4 shadow-sm">
                      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        {activeTab === 'STOCK' ? <span className="font-black text-sm uppercase">{selectedVariant?.size}</span> : <DollarSign size={24} />}
                      </div>
                      <div>
                        <h4 className="font-black text-on-surface uppercase leading-tight text-lg">{activeTab === 'STOCK' ? selectedVariant?.color : 'Precio General'}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'STOCK' ? selectedVariant?.sku : localProduct?.name}</p>
                      </div>
                    </div>

                    {activeTab === 'STOCK' ? (
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Variación de Unidades</label>
                          <div className="flex items-center gap-4">
                            <button onClick={() => setAdjustmentValue(v => v - 1)} className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-error/10 hover:text-error transition-all shadow-sm"><Minus size={24} /></button>
                            <div className="flex-1 h-16 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center shadow-inner">
                              <input type="number" value={adjustmentValue} onChange={(e) => setAdjustmentValue(Number(e.target.value))} className="w-full bg-transparent border-none text-center text-3xl font-black text-on-surface focus:ring-0" />
                            </div>
                            <button onClick={() => setAdjustmentValue(v => v + 1)} className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-tertiary/10 hover:text-tertiary transition-all shadow-sm"><Plus size={24} /></button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Motivo del Ajuste (Obligatorio)</label>
                          <div className="grid grid-cols-3 gap-3">
                            {(adjustmentValue >= 0 ? STOCK_REASONS_POSITIVE : STOCK_REASONS_NEGATIVE).map(r => (
                              <button key={r.id} onClick={() => setSelectedReason(r.id)} className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${selectedReason === r.id ? 'bg-white border-primary shadow-xl shadow-primary/10 ring-4 ring-primary/5' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}>
                                <r.icon className={selectedReason === r.id ? 'text-primary' : 'text-slate-300'} size={24} />
                                <span className={`text-[10px] font-black uppercase tracking-[0.1em] text-center ${selectedReason === r.id ? 'text-on-surface' : 'text-slate-400'}`}>{r.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2 flex items-center gap-2"><MessageSquare size={12} />Observaciones (Opcional)</label>
                          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Stock dañado..." className="w-full h-24 bg-white border border-slate-100 rounded-[2rem] p-6 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none shadow-sm resize-none transition-all" />
                        </div>

                        <button disabled={isSaving || adjustmentValue === 0 || !selectedReason} onClick={handleStockAction} className={`w-full py-5 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-xl ${adjustmentValue > 0 ? 'bg-tertiary' : 'bg-error'}`}>
                          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Ajuste'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="bg-slate-900 rounded-[2rem] p-6 border-4 border-slate-800 focus-within:border-primary transition-all shadow-xl">
                             <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-3 px-1">Efectivo (PVP)</label>
                             <div className="flex items-baseline gap-2">
                               <span className="text-xl font-black text-slate-600">$</span>
                               <input type="number" className="bg-transparent text-4xl font-black text-white outline-none w-full placeholder:text-slate-800" placeholder="0" value={priceCash || ''} onChange={(e) => { const newVal = Number(e.target.value); setPriceCash(newVal); setMargin(calculateMargin(cost, newVal, (localProduct as any)?.ivaRate || 21)); }} />
                             </div>
                           </div>
                           <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 px-1">Débito</label>
                             <div className="flex items-baseline gap-2">
                               <span className="text-xl font-black text-slate-300">$</span>
                               <input type="number" className="bg-transparent text-3xl font-black text-slate-800 outline-none w-full placeholder:text-slate-200" placeholder="0" value={priceDebit || ''} onChange={(e) => setPriceDebit(Number(e.target.value))} />
                             </div>
                           </div>
                           <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 px-1">Crédito</label>
                             <div className="flex items-baseline gap-2">
                               <span className="text-xl font-black text-slate-300">$</span>
                               <input type="number" className="bg-transparent text-3xl font-black text-slate-800 outline-none w-full placeholder:text-slate-200" placeholder="0" value={priceCredit || ''} onChange={(e) => setPriceCredit(Number(e.target.value))} />
                             </div>
                           </div>
                         </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2">Motivo del Ajuste (Obligatorio)</label>
                          <div className="grid grid-cols-2 gap-3">
                            {FINANCIAL_REASONS.map(r => (
                              <button 
                                key={r.id} 
                                onClick={() => setFinancialReason(r.id)} 
                                className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
                                  financialReason === r.id ? 'bg-white border-primary shadow-xl shadow-primary/10 ring-4 ring-primary/5' : 'bg-white border-slate-100'
                                }`}
                              >
                                <r.icon className={financialReason === r.id ? 'text-primary' : 'text-slate-300'} size={24} />
                                <span className={`text-[10px] font-black uppercase tracking-[0.1em] text-center ${financialReason === r.id ? 'text-on-surface' : 'text-slate-400'}`}>
                                  {r.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-2 flex items-center gap-2">
                            <MessageSquare size={12} />
                            Observaciones (Opcional)
                          </label>
                          <textarea
                            value={financialDescription}
                            onChange={(e) => setFinancialDescription(e.target.value)}
                            placeholder="Ej: Ajuste por inflación mensual..."
                            className="w-full h-24 bg-white border border-slate-100 rounded-[2rem] p-6 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none shadow-sm resize-none transition-all"
                          />
                        </div>

                        <div className="pt-6">
                          <div className="bg-primary p-10 rounded-[3rem] text-white text-center shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10 space-y-4">
                               <div>
                                 <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Efectivo</p>
                                 <p className="text-5xl lg:text-6xl font-black italic tracking-tighter">${priceCash.toLocaleString()}</p>
                               </div>
                               <div className="flex justify-center gap-10 pt-6 border-t border-white/10">
                                 <div>
                                   <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Débito</p>
                                   <p className="text-2xl font-black italic tracking-tighter">${priceDebit.toLocaleString()}</p>
                                 </div>
                                 <div>
                                   <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Crédito</p>
                                   <p className="text-2xl font-black italic tracking-tighter">${priceCredit.toLocaleString()}</p>
                                 </div>
                               </div>
                            </div>
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                               <DollarSign size={80} />
                            </div>
                          </div>
                        </div>

                        <button 
                          disabled={isSaving || isUpdating || !financialReason}
                          onClick={handleFinancialAction}
                          className={`w-full py-5 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-xl ${
                            (margin >= (selectedVariant?.margin || 0) && priceCash >= (selectedVariant?.priceCash || 0))
                              ? 'bg-tertiary shadow-tertiary/20'
                              : 'bg-error shadow-error/20'
                          }`}
                        >
                          {isSaving || isUpdating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Precios Generales'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
