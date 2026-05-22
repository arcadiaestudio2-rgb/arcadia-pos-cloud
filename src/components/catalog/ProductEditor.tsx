import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Info,
  DollarSign,
  Plus,
  ArrowLeft,
  RotateCcw,
  Trash2,
  Barcode,
  Eye,
  Truck,
  Zap,
  Save,
  CheckSquare,
  Square,
  Search,
  Link,
  Box,
  Settings2,
  X as XIcon,
  Clock
} from 'lucide-react';

// Utility for smart size sorting moved to utils/format.ts
import { api } from '../../services/api';
import { Button, toast, formatCurrency, formatDate, compareSizes } from '../common/CommonUI';
import { useOperator } from '../../hooks/useOperator';
import { normalizeAttributeValue, sanitizeNumericSize } from '../../utils/validation';

import { calculatePriceCash, calculateMargin } from '../../utils/pricing';

interface VariantRow {
  id: string;
  sku: string;
  color: string;
  size: string;
  stock: number | string;
  stockMinimo: number | string;
  cost: number | string;
  margin: number | string;
  priceCash: number | string;
  priceDebit: number | string;
  priceCredit: number | string;
  isCustom?: boolean;
}

const DEFAULT_ATTRIBUTES: any = {
  brands: ['Alpine Pro', 'Luxe Core', 'Zen Tech', 'Nordic Edge'],
  seasons: ['INV 24', 'VER 24', 'CONT', 'PRE-FA'],
  alpha: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  numeric: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
  colors: ['Negro', 'Blanco', 'Azul Marino', 'Gris Melange', 'Beige', 'Bordeaux', 'Verde Militar'],
};

const CATEGORY_PREFIXES: Record<string, string> = {
  'Remeras': 'REM',
  'Pantalones': 'PAN',
  'Zapatillas': 'ZAP',
  'Vestidos': 'VES',
  'Ropa Interior': 'INT',
  'Camperas': 'CAM',
  'Buzos': 'BUZ',
  'Gorras': 'GOR',
  'Accesorios': 'ACC'
};

const CATEGORIES = Object.keys(CATEGORY_PREFIXES);

const getColorCode = (colorName: string) => {
  const colors: Record<string, string> = {
    'Negro': '#000000',
    'Blanco': '#FFFFFF',
    'Rojo': '#EF4444',
    'Azul': '#3B82F6',
    'Verde': '#10B981',
    'Amarillo': '#F59E0B',
    'Gris': '#6B7280',
    'Rosa': '#EC4899',
    'Celeste': '#0EA5E9',
    'Naranja': '#F97316',
    'Marron': '#78350F',
    'Marrón': '#78350F',
    'Beige': '#F5F5DC',
    'Bordeaux': '#800020',
    'Azul Marino': '#000080',
    'Gris Melange': '#BEBEBE',
    'Verde Militar': '#4B5320'
  };
  return colors[colorName] || '#CBD5E1';
};

export function ProductEditor({ product, onClose }: { product?: any, onClose: () => void }) {
  const { selectedOperator } = useOperator();
  const operatorId = typeof selectedOperator === 'object' ? String(selectedOperator?.id || '0') : '0';
  
  // --- Form State ---
  const [productName, setProductName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState('');
  const [barcode, setBarcode] = useState('');
  const [baseCost, setBaseCost] = useState<number | string>('0');
  const [baseMargin, setBaseMargin] = useState<number | string>('60'); 
  const [baseStockMin, setBaseStockMin] = useState<number | string>('5'); 
  const [ivaRate, setIvaRate] = useState(21); 
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dbAttributes, setDbAttributes] = useState(() => {
    const saved = localStorage.getItem('arcadia_catalog_attributes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_ATTRIBUTES;
      }
    }
    return DEFAULT_ATTRIBUTES;
  });

  const [fees] = useState(() => {
    const saved = localStorage.getItem('arcadia_fees');
    return saved ? JSON.parse(saved) : {
      cashDiscount: 0,
      debitSurcharge: 0,
      creditSurcharges: { 1: 0, 3: 0 }
    };
  });

  // --- Supplier State ---
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [showNewSupplierForm, setShowNewSupplierForm] = useState<boolean>(false);
  const [showNewAttributeForm, setShowNewAttributeForm] = useState<string | null>(null);

  const toggleAttribute = (type: 'sizes' | 'colors', value: string) => {
    if (type === 'sizes') {
      setSelectedSizes(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]);
    } else {
      setSelectedColors(prev => prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]);
    }
  };


  // --- Attributes Selection ---
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [basePrice, setBasePrice] = useState<number | string>('0');
  const [basePriceDebit, setBasePriceDebit] = useState<number | string>('0');
  const [basePriceCredit, setBasePriceCredit] = useState<number | string>('0');
  
  // --- Supplier State ---
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierCuit, setNewSupplierCuit] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  
  
  const currentSizeType = useMemo(() => {
    if (!categoryId) return 'alpha';
    const cat = categoryId.toLowerCase();
    // Logic: Shoes (zapatillas/calzado) -> numeric, Accessories/Hats -> none, others (clothing/prenda) -> alpha
    if (cat.includes('zapa') || cat.includes('calzado')) return 'numeric';
    if (cat.includes('acce') || cat.includes('gorra')) return 'none';
    return 'alpha';
  }, [categoryId]);

  // FIX: Clear selected sizes when size type changes (e.g. switching from Shoes to Clothing)
  // This prevents alpha and numeric sizes from "overlapping" or mixing in the matrix.
  useEffect(() => {
    setSelectedSizes([]);
  }, [currentSizeType]);


  // Load attributes from DB
  const loadAttributes = async () => {
    try {
      const supp = await api.getSuppliers();
      setSuppliers(supp || []);
    } catch (err) {
      console.warn('[ProductEditor] Could not load suppliers:', err);
    }
  };

  useEffect(() => { 
    loadAttributes(); 
  }, []);

  // Initialize for editing
  useEffect(() => {
    if (product) {
      setProductName(product.name || '');
      setCategoryId(product.category || '');
      setBrand(product.brand || '');
      setSeason(product.season || '');
      setBarcode(product.barcode || '');
      setIvaRate(Number(product.iva_rate) || 21);
      // Link base_price to the Cost field as requested
      setBaseCost(product.cost || 0);
      setBaseMargin(product.base_margin || 60);
      // setBaseStockMin(product.total_stockMinimo || 5);
      
      // Initialize Master Price (Cash)
      setBasePrice(product.base_price || 0);
      
      if (product.provider_info) {
        try {
          const pInfo = typeof product.provider_info === 'string' ? JSON.parse(product.provider_info) : product.provider_info;
          if (pInfo && pInfo.id) {
            setSelectedSupplierId(pInfo.id.toString());
          }
          if (pInfo && pInfo.remito) {
            setInvoiceNumber(pInfo.remito || '');
          }
          
          // Load manual price overrides if they exist
          if (pInfo && pInfo.manual_prices) {
            setBasePriceDebit(pInfo.manual_prices.debito || pInfo.manual_prices.debit || 0);
            setBasePriceCredit(pInfo.manual_prices.credito || pInfo.manual_prices.credit || 0);
          }
        } catch (e) {
          console.error('[Editor] Error parsing provider_info:', e);
        }
      }
      
      api.getProductVariants(product.id).then(vData => {
         setVariants(vData.map((v: any) => ({
            id: v.id.toString(),
            sku: v.sku,
            color: v.color,
            size: v.size,
            stock: v.stock || 0,
            stockMinimo: v.stockMinimo || 0,
            cost: v.cost || product?.cost || 0,
            margin: v.margin || product?.base_margin || 60,
            priceCash: v.pvp || v.priceCash || product?.cost || 0,
            priceDebit: v.debit_price || v.priceDebit || 0,
            priceCredit: v.credit_price || v.priceCredit || 0,
            isCustom: Number(v.cost) !== (Number(product?.cost) || 0) || Number(v.margin) !== (Number(product?.base_margin) || 60)
         })));
         
         const sizes = Array.from(new Set(vData.map((v: any) => v.size)));
         const colors = Array.from(new Set(vData.map((v: any) => v.color)));
         setSelectedSizes(sizes as string[]);
         setSelectedColors(colors as string[]);
      }).catch(() => toast.error('Error al cargar variantes'));
    }
  }, [product]);

  const validate = () => {
    if (!productName.trim()) {
      toast.error('El nombre del producto es obligatorio');
      return false;
    }
    
    const costNum = Number(baseCost);
    if (isNaN(costNum)) {
      toast.error('Error: El costo debe ser un número válido');
      return false;
    }

    if (variants.length === 0) {
      toast.error('Debe seleccionar al menos un talle y un color');
      return false;
    }
    return true;
  };

  const [barcodeWarning, setBarcodeWarning] = useState<{ uuid: string; name: string } | null>(null);
  const [matrixFilter, setMatrixFilter] = useState('');

  const checkBarcode = async (val: string) => {
    if (!val || product) return;
    try {
      const existing = await api.getProductByBarcode(val);
      if (existing) {
        setBarcodeWarning({ uuid: (existing as any).id, name: existing.name });
      } else {
        setBarcodeWarning(null);
      }
    } catch (error) {
      setBarcodeWarning(null);
    } finally {
    }
  };

  const clearFields = () => {
    setProductName('');
    setCategoryId('');
    setBrand('');
    setSeason('');
    setBarcode('');
    setBaseCost('0');
    setBaseMargin('60');
    setBaseStockMin('5');
    setBasePrice('0');
    setBasePriceDebit('0');
    setBasePriceCredit('0');
    setIvaRate(21);
    setSelectedSizes([]);
    setSelectedColors([]);
    setVariants([]);
    setErrors([]);
    setSelectedSupplierId('');
    setInvoiceNumber('');
    setShowNewSupplierForm(false);
    setNewSupplierName('');
    setNewSupplierCuit('');
    setNewSupplierPhone('');
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }
    if (!newSupplierCuit.trim()) {
      toast.error('El CUIT del proveedor es obligatorio');
      return;
    }
    const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
    if (!cuitRegex.test(newSupplierCuit.trim())) {
      toast.error('Formato de CUIT inválido. Debe ser XX-XXXXXXXX-X');
      return;
    }

    try {
      setLoading(true);
      const created = await api.createSupplier({
        name: newSupplierName.trim(),
        cuit: newSupplierCuit.trim(),
        phone: newSupplierPhone.trim() || undefined
      });
      toast.success('Proveedor creado correctamente');
      
      const supp = await api.getSuppliers();
      setSuppliers(supp || []);
      
      if (created && created.id) {
        setSelectedSupplierId(created.id.toString());
      }
      
      setNewSupplierName('');
      setNewSupplierCuit('');
      setNewSupplierPhone('');
      setShowNewSupplierForm(false);
    } catch (error: any) {
      console.error('[Editor] Error creating supplier:', error);
      toast.error(error.message || 'Error al crear el proveedor');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors([]);
    
    try {
      // Barcode collision check before saving
      if (!product && barcode) {
        const existing = await api.getProductByBarcode(barcode);
        if (existing) {
          toast.error(`Error: El código de barras ${barcode} ya existe en "${existing.name}"`);
          setLoading(false);
          return;
        }
      }

      // SKU collision check for new variants
      const newVariants = variants.filter(v => v.id.startsWith('new-'));
      
      // Basic validation for empty SKUs
      if (variants.some(v => !v.sku.trim())) {
        toast.error('Error: Todos los productos en la matriz deben tener un SKU');
        setLoading(false);
        return;
      }

      if (newVariants.length > 0) {
        for (const v of newVariants) {
          const existingVariant = await api.getVariantBySku(v.sku);
          if (existingVariant) {
            toast.error(`Error de Matriz: El SKU ${v.sku} ya está en uso.`);
            setLoading(false);
            return;
          }
        }
      }

      // Instruction 7 & 9: Data Mapping & Type Validation
      // Force Number casting for all numeric fields
      const finalBasePrice = Number(basePrice) || 0;
      const finalBaseCost = Number(baseCost) || 0;
      const finalBasePriceDebit = Number(basePriceDebit) || (finalBasePrice * (1 + (fees.debitSurcharge / 100)));
      const finalBasePriceCredit = Number(basePriceCredit) || (finalBasePrice * (1 + (fees.creditSurcharges[1] / 100)));
      const finalIvaRate = Number(ivaRate) || 21;
      
      const finalCategory = categoryId || 'General';
      const finalBarcode = barcode.trim() || `GEN-${Date.now()}`;

      const variantPayload = variants.map(v => {
        return {
          id: v.id.startsWith('new-') ? undefined : String(v.id),
          sku: v.sku.trim(),
          size: v.size,
          color: v.color,
          stock: Number(v.stock) || 0,
          stockMinimo: Number(v.stockMinimo) || 5,
          cost: Number(v.cost) || 0,
          margin: Number(v.margin) || 0,
          priceCash: Number(v.priceCash) || 0,
          priceDebit: Number(v.priceDebit) || 0,
          priceCredit: Number(v.priceCredit) || 0,
        };
      });

      const payload = {
        name: productName.trim(),
        category: finalCategory,
        brand,
        season,
        barcode: finalBarcode,
        ivaRate: finalIvaRate,
        basePrice: finalBasePrice,
        priceCash: finalBasePrice,
        priceDebit: finalBasePriceDebit,
        priceCredit: finalBasePriceCredit,
        cost: finalBaseCost,
        baseMargin: calculateMargin(finalBaseCost, finalBasePrice, finalIvaRate),
        providerInfo: {
          id: selectedSupplierId ? String(selectedSupplierId) : null,
          remito: invoiceNumber,
          manual_prices: {
            efectivo: finalBasePrice,
            debito: finalBasePriceDebit,
            credito: finalBasePriceCredit
          }
        },
        variants: variantPayload,
      };

      if (product) {
        await api.updateProduct(product.id, {
          ...payload,
          operatorId: operatorId
        });
        toast.success(`"${productName}" actualizado correctamente`);
        // Trigger global refresh for UI consistency
        window.dispatchEvent(new CustomEvent('refresh-stock'));
        
        // Pequeño delay para asegurar que el evento se procese antes de cerrar
        setTimeout(() => onClose(), 100);
      } else {
        await api.createProduct(payload);

        toast.success(`"${productName}" creado con éxito en el catálogo`);
        window.dispatchEvent(new CustomEvent('refresh-stock'));
        clearFields();
      }
    } catch (error: any) {
      console.error("[Editor] Error en handleSave:", error);
      const isTimeout = error.message?.includes('Timeout') || error.message?.includes('tardó demasiado');
      toast.error(isTimeout ? 'Error de Red: El servidor no respondió a tiempo.' : (error.message || 'Error crítico en la persistencia.'));
    } finally {
      setLoading(false);
    }
  };



  const handleAddAttribute = async (type: string, value: string) => {
    const rawValue = value.trim();
    const normalized = normalizeAttributeValue(rawValue);

    const exists = (dbAttributes[type] || []).some(
      (v: string) => normalizeAttributeValue(v) === normalized
    );

    if (exists) {
      toast.info(`"${rawValue}" ya existe`);
      return;
    }

    const updated = { ...dbAttributes, [type]: [...(dbAttributes[type] || []), rawValue] };
    setDbAttributes(updated);
    localStorage.setItem('arcadia_catalog_attributes', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('refresh-attributes'));
    toast.success(`${rawValue} agregado`);
  };

  const handleRemoveAttribute = async (type: string, value: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${value}"?`)) return;
    try {
      const updated = { 
        ...dbAttributes, 
        [type]: dbAttributes[type].filter((v: string) => v !== value) 
      };
      setDbAttributes(updated);
      localStorage.setItem('arcadia_catalog_attributes', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('refresh-attributes'));
      toast.success(`${value} eliminado`);
    } catch (error) {
      toast.error('Error al eliminar atributo');
    }
  };

  // Matrix Generation logic
  useEffect(() => {
    if ((selectedSizes.length === 0 && currentSizeType !== 'none') || selectedColors.length === 0) {
      if (!product) setVariants([]); 
      return;
    }
    
    setVariants(prev => {
      const newVariants: VariantRow[] = [];
      selectedColors.forEach(color => {
        const sizesToProcess = currentSizeType === 'none' ? ['U'] : selectedSizes;
        sizesToProcess.forEach(size => {
          const existing = prev.find(v => v.color === color && v.size === size);

          // Siempre recalcular el SKU con la categoría actual — formato estándar 4 partes
          const rubroId = (categoryId || 'GEN').substring(0, 3).toUpperCase().padEnd(3, 'X');
          const colorId = (color || 'XXX').substring(0, 3).toUpperCase().padEnd(3, 'X');
          const talleId = size || 'UNI';
          // Preservar sufijo existente si ya fue generado (mantiene identidad única)
          const existingSuffix = existing?.sku?.split('-')[3];
          const shortId = (existingSuffix && existingSuffix.length === 4)
            ? existingSuffix
            : Math.random().toString(36).substring(2, 6).toUpperCase();
          const generatedSku = `${rubroId}-${colorId}-${talleId}-${shortId}`;

          if (existing) {
            // Preservar datos pero actualizar el prefijo del SKU
            newVariants.push({ ...existing, sku: generatedSku });
          } else {
            newVariants.push({
              id: `new-${Date.now()}-${color}-${size}`,
              sku: generatedSku,
              color, size,
              stock: 0,
              stockMinimo: baseStockMin,
              cost: baseCost,
              margin: baseMargin,
              priceCash: basePrice,
              priceDebit: basePriceDebit,
              priceCredit: basePriceCredit,
              isCustom: false
            });
          }
        });
      });
      return newVariants;
    });
  }, [selectedSizes, selectedColors, currentSizeType, categoryId, baseCost, baseMargin, basePrice]);

  // Auto-sync variants when base values change
  useEffect(() => {
    setVariants(prev => prev.map(v => {
      // Only sync if NOT custom
      if (v.isCustom) return v;
      return {
        ...v,
        cost: baseCost,
        margin: calculateMargin(Number(baseCost), Number(basePrice), ivaRate),
        priceCash: basePrice,
        priceDebit: basePriceDebit,
        priceCredit: basePriceCredit
      };
    }));
  }, [baseCost, baseMargin, ivaRate, basePrice, basePriceDebit, basePriceCredit]);

  const updateVariant = (id: string, field: keyof VariantRow, value: any) => {
    setVariants(prev => {
      const index = prev.findIndex(v => v.id === id);
      if (index === -1) return prev;
      
      const next = [...prev];
      const updatedVariant = { ...next[index], [field]: value };
      
      // Auto-detach if pricing fields change
      if (field === 'cost' || field === 'margin' || field === 'priceCash' || field === 'priceDebit' || field === 'priceCredit') {
        updatedVariant.isCustom = true;
      }

      if (field === 'cost' || field === 'margin') {
        updatedVariant.priceCash = calculatePriceCash(Number(updatedVariant.cost), Number(updatedVariant.margin), ivaRate);
      } else if (field === 'priceCash') {
        // Recalculate margin if priceCash is edited directly
        updatedVariant.margin = calculateMargin(Number(updatedVariant.cost), Number(updatedVariant.priceCash), ivaRate);
      }
      
      next[index] = updatedVariant;
      return next;
    });
  };



  const toggleSelection = (id: string) => {
    setSelectedVariantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = (filteredVariants: VariantRow[]) => {
    if (selectedVariantIds.size === filteredVariants.length && filteredVariants.length > 0) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(filteredVariants.map(v => v.id)));
    }
  };

  const bulkAction = (action: 'link' | 'unlink' | 'stock_min') => {
    const ids = Array.from(selectedVariantIds);
    if (ids.length === 0) return;

    setVariants(prev => prev.map(v => {
      if (!selectedVariantIds.has(v.id)) return v;
      
      if (action === 'link') {
        return {
          ...v,
          isCustom: false,
          cost: baseCost,
          margin: baseMargin,
          priceCash: calculatePriceCash(Number(baseCost), Number(baseMargin), ivaRate),
          priceDebit: basePriceDebit,
          priceCredit: basePriceCredit
        };
      }
      if (action === 'unlink') return { ...v, isCustom: true };
      if (action === 'stock_min') return { ...v, stockMinimo: baseStockMin };
      
      return v;
    }));
    
    toast.success(`Acción aplicada a ${ids.length} variantes`);
  };

  const removeVariant = (id: string) => {
    setVariants(prev => prev.filter(v => v.id !== id));
  };

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setter: (val: string) => void, currentVal: any) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const current = Number(currentVal) || 0;
      const next = e.key === 'ArrowUp' ? current + step : Math.max(0, current - step);
      setter(String(next));
    }
  };

  const handleVariantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string, field: keyof VariantRow, currentVal: any) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const current = Number(currentVal) || 0;
      const next = e.key === 'ArrowUp' ? current + step : Math.max(0, current - step);
      updateVariant(id, field, String(next));
    }
  };

  const sizesToShow = useMemo(() => {
    if (currentSizeType === 'none') return ['U'];
    
    // Filter sizes based on current type to avoid mixing alpha/numeric
    const sizes = (currentSizeType === 'numeric' 
      ? (dbAttributes.numeric || [])
      : (dbAttributes.alpha || [])) as string[];
      
    return Array.from(new Set(sizes)).sort(compareSizes);
  }, [currentSizeType, dbAttributes]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <button className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-primary transition-all" onClick={onClose}>
             <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-2xl font-black font-headline tracking-tighter text-slate-800">Maestro de Producto</h2>
            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
               <Info size={10} className="text-primary" /> Editor de Inventario v2.2
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {product && (
            <button 
              disabled 
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100 group relative"
              title="Eliminación deshabilitada por seguridad"
            >
              <Trash2 size={20} />
              <div className="absolute -bottom-10 right-0 scale-0 group-hover:scale-100 transition-all bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-[60]">
                Eliminación restringida
              </div>
            </button>
          )}
          <Button onClick={handleSave} disabled={loading} className="px-8 h-12 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-white font-black uppercase tracking-widest flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save size={18} /> {product ? 'Actualizar Producto' : 'Crear Producto'}</>
            )}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 lg:p-10 bg-slate-50/50">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
          
          {/* Row 1: Identity & Attributes */}
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-6 flex flex-col gap-8">
            <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Box size={20} />
                </div>
                <h3 className="text-sm font-black tracking-tight text-slate-600">Identidad del Producto</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400">Código de Barras Principal</label>
                  <div className="relative">
                    <Barcode className={`absolute left-4 top-1/2 -translate-y-1/2 ${barcodeWarning ? 'text-orange-500' : 'text-slate-300'}`} size={18} />
                    <input 
                      className={`w-full h-14 bg-slate-50 border-2 rounded-2xl pl-12 pr-4 text-sm font-bold focus:ring-4 transition-all ${barcodeWarning ? 'border-orange-200 bg-orange-50/30' : 'border-transparent focus:ring-primary/10'}`}
                      placeholder="Escanear EAN13..."
                      value={barcode}
                      onChange={(e) => {
                        setBarcode(e.target.value);
                        if (e.target.value.length > 5) checkBarcode(e.target.value);
                      }}
                    />
                    {barcodeWarning && (
                      <button className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-orange-600 transition-all">
                        <Eye size={12} /> Ver Existente
                      </button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400">Nombre / Modelo</label>
                  <input 
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    placeholder="Ej: Remera Over-sized Cotton"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>



                <div className="space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400">Rubro (Categoría)</label>
                    <button 
                      onClick={() => setShowNewAttributeForm(showNewAttributeForm === 'categories' ? null : 'categories')}
                      className={`p-1 rounded-lg transition-all ${showNewAttributeForm === 'categories' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400 hover:bg-primary hover:text-white'}`}
                    >
                      {showNewAttributeForm === 'categories' ? <XIcon size={12} /> : <Plus size={12} />}
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {showNewAttributeForm === 'categories' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute z-[60] -left-4 w-80 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-5 px-1">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Gestionar Rubros</span>
                           <button onClick={() => setShowNewAttributeForm(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-error rounded-full transition-all">
                              <XIcon size={18} />
                           </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <input 
                            autoFocus
                            placeholder="Nuevo..."
                            className="flex-1 h-11 bg-slate-50 border-none rounded-xl px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val) handleAddAttribute('categories', val);
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) handleAddAttribute('categories', val);
                            }}
                            className="h-11 w-11 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                           {[...new Set([...CATEGORIES, ...(dbAttributes.categories || [])])].sort().map((c: string) => (
                              <div key={c} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                 <span className="text-xs font-bold text-slate-700">{c}</span>
                                 <button 
                                    onClick={() => handleRemoveAttribute('categories', c)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-error transition-all"
                                 >
                                    <XIcon size={14} strokeWidth={3} />
                                 </button>
                              </div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <select 
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {[...new Set([...CATEGORIES, ...(dbAttributes.categories || [])])].sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400">Marca</label>
                    <button 
                      onClick={() => setShowNewAttributeForm(showNewAttributeForm === 'brands' ? null : 'brands')}
                      className={`p-1 rounded-lg transition-all ${showNewAttributeForm === 'brands' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400 hover:bg-primary hover:text-white'}`}
                    >
                      {showNewAttributeForm === 'brands' ? <XIcon size={12} /> : <Plus size={12} />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewAttributeForm === 'brands' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute z-[60] -left-4 w-80 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-5 px-1">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Gestionar Marcas</span>
                           <button onClick={() => setShowNewAttributeForm(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-error rounded-full transition-all">
                              <XIcon size={18} />
                           </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <input 
                            autoFocus
                            placeholder="Nueva..."
                            className="flex-1 h-11 bg-slate-50 border-none rounded-xl px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val) handleAddAttribute('brands', val);
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) handleAddAttribute('brands', val);
                            }}
                            className="h-11 w-11 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                           {[...(dbAttributes.brands || [])].sort().map((b: string) => (
                              <div key={b} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                 <span className="text-xs font-bold text-slate-700">{b}</span>
                                 <button 
                                    onClick={() => handleRemoveAttribute('brands', b)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-error transition-all"
                                 >
                                    <XIcon size={14} strokeWidth={3} />
                                 </button>
                              </div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <select 
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {dbAttributes.brands.sort().map((b: string) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400">Temporada</label>
                    <button 
                      onClick={() => setShowNewAttributeForm(showNewAttributeForm === 'seasons' ? null : 'seasons')}
                      className={`p-1 rounded-lg transition-all ${showNewAttributeForm === 'seasons' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400 hover:bg-primary hover:text-white'}`}
                    >
                      {showNewAttributeForm === 'seasons' ? <XIcon size={12} /> : <Plus size={12} />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewAttributeForm === 'seasons' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute z-[60] -left-4 w-80 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-5 px-1">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Gestionar Temporadas</span>
                           <button onClick={() => setShowNewAttributeForm(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-error rounded-full transition-all">
                              <XIcon size={18} />
                           </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <input 
                            autoFocus
                            placeholder="Nueva..."
                            className="flex-1 h-11 bg-slate-50 border-none rounded-xl px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val) handleAddAttribute('seasons', val);
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) handleAddAttribute('seasons', val);
                            }}
                            className="h-11 w-11 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                           {[...(dbAttributes.seasons || [])].sort().map((s: string) => (
                              <div key={s} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                 <span className="text-xs font-bold text-slate-700">{s}</span>
                                 <button 
                                    onClick={() => handleRemoveAttribute('seasons', s)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-error transition-all"
                                 >
                                    <XIcon size={14} strokeWidth={3} />
                                 </button>
                              </div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <select 
                    className="w-full h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {dbAttributes.seasons.sort().map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* Supplier / Proveedor Section */}
            <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-slate-600">Proveedor del Producto</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Asigna un proveedor y número de remito</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Supplier */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 block">
                    Seleccionar Proveedor
                  </label>
                  <select
                    className="w-full h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold outline-none"
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                  >
                    <option value="">No asignado</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.cuit ? `(${s.cuit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remito / Invoice Number */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 block">
                    Número de Remito / Factura
                  </label>
                  <input
                    type="text"
                    className="w-full h-12 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    placeholder="Ej: 0001-00001234"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>

                {/* New Supplier Toggle & Inline Form */}
                <div className="md:col-span-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => setShowNewSupplierForm(!showNewSupplierForm)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 transition-all"
                  >
                    <Plus size={16} />
                    {showNewSupplierForm ? 'Cancelar creación' : 'Crear nuevo proveedor'}
                  </button>

                  <AnimatePresence>
                    {showNewSupplierForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-4 mt-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 block">
                            Nombre del Proveedor *
                          </label>
                          <input
                            type="text"
                            className="w-full h-11 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-4 text-sm font-bold outline-none transition-all"
                            placeholder="Ej: Distribuidora Central S.A."
                            value={newSupplierName}
                            onChange={(e) => setNewSupplierName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 block">
                            CUIT (XX-XXXXXXXX-X) *
                          </label>
                          <input
                            type="text"
                            className="w-full h-11 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-4 text-sm font-bold outline-none transition-all"
                            placeholder="Ej: 20-12345678-9"
                            value={newSupplierCuit}
                            onChange={(e) => setNewSupplierCuit(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 block">
                            Teléfono de contacto (Opcional)
                          </label>
                          <input
                            type="text"
                            className="w-full h-11 bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-4 text-sm font-bold outline-none transition-all"
                            placeholder="Ej: +54 9 11 1234-5678"
                            value={newSupplierPhone}
                            onChange={(e) => setNewSupplierPhone(e.target.value)}
                          />
                        </div>

                        <button
                          onClick={handleCreateSupplier}
                          disabled={loading}
                          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black tracking-wider text-xs rounded-xl shadow-sm transition-all"
                        >
                          {loading ? 'Guardando...' : 'Guardar Proveedor'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            {/* Pricing Section (Compact) */}
            <section className="bg-[#0F172A] rounded-[2rem] p-5 lg:p-6 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -z-10" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[80px] -z-10" />

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
                  <Zap size={18} />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-white tracking-tight">Carga de Precios</h3>
                  <p className="text-[9px] font-bold text-slate-500 tracking-widest">Ajuste manual de 4 puntas</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Costo */}
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-700 transition-all group/card">
                  <label className="text-[9px] font-black text-slate-500 block mb-2 group-hover/card:text-slate-400 transition-colors">Costo Neto (Opcional)</label>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-700">$</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      className="bg-transparent text-2xl font-black text-white outline-none w-full placeholder:text-slate-800"
                      placeholder="0.00"
                      value={baseCost}
                      onChange={(e) => setBaseCost(e.target.value)}
                      onKeyDown={(e) => handleNumberKeyDown(e, setBaseCost, baseCost)}
                    />
                  </div>
                </div>

                {/* Efectivo */}
                <div className="bg-primary/10 rounded-2xl p-4 border-2 border-primary/20 hover:border-primary/40 transition-all group/card ring-1 ring-primary/5">
                  <label className="text-[9px] font-black text-primary/60 block mb-2 group-hover/card:text-primary transition-colors">Efectivo (Cash)</label>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-primary/40">$</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      className="bg-transparent text-2xl font-black text-white outline-none w-full placeholder:text-slate-800"
                      placeholder="0.00"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      onKeyDown={(e) => handleNumberKeyDown(e, setBasePrice, basePrice)}
                    />
                  </div>
                </div>

                {/* Débito */}
                <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-700 transition-all group/card">
                  <label className="text-[9px] font-black text-slate-500 block mb-2 group-hover/card:text-slate-400 transition-colors">Precio Débito</label>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-700">$</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      className="bg-transparent text-2xl font-black text-white outline-none w-full placeholder:text-slate-800"
                      placeholder="0.00"
                      value={basePriceDebit}
                      onChange={(e) => setBasePriceDebit(e.target.value)}
                      onKeyDown={(e) => handleNumberKeyDown(e, setBasePriceDebit, basePriceDebit)}
                    />
                  </div>
                </div>

                {/* Crédito */}
                <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-700 transition-all group/card">
                  <label className="text-[9px] font-black text-slate-500 block mb-2 group-hover/card:text-slate-400 transition-colors">Precio Crédito</label>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-700">$</span>
                    <input 
                      type="text"
                      inputMode="decimal"
                      className="bg-transparent text-2xl font-black text-white outline-none w-full placeholder:text-slate-800"
                      placeholder="0.00"
                      value={basePriceCredit}
                      onChange={(e) => setBasePriceCredit(e.target.value)}
                      onKeyDown={(e) => handleNumberKeyDown(e, setBasePriceCredit, basePriceCredit)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => {
                    const cash = Number(basePrice) || 0;
                    setBasePriceDebit((cash * (1 + fees.debitSurcharge / 100)).toFixed(0));
                    setBasePriceCredit((cash * (1 + fees.creditSurcharges[1] / 100)).toFixed(0));
                    toast.success('Sugerencias aplicadas');
                  }}
                  className="group flex items-center gap-2 text-[9px] font-black text-slate-600 tracking-widest hover:text-primary transition-all bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-800"
                >
                  <RotateCcw size={12} className="group-hover:rotate-180 transition-transform duration-500" />
                  Sugerir precios
                </button>
              </div>
            </section>
          </div>

          {/* Row 1 Right Column: Attributes */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-8">
            <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10 flex-1">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Settings2 size={20} />
                </div>
                <h3 className="text-sm font-black tracking-tight text-slate-600">Variaciones y Stock</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-10">
                {/* Talles */}
                <div className="space-y-6 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2">
                       Talles Seleccionados <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[9px]">{selectedSizes.length}</span>
                    </label>
                    <button 
                      onClick={() => setShowNewAttributeForm(showNewAttributeForm === 'sizes' ? null : 'sizes')}
                      className="text-[9px] font-black text-primary tracking-widest hover:underline"
                    >
                      {showNewAttributeForm === 'sizes' ? 'CANCELAR' : '+ Nuevo Talle'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewAttributeForm === 'sizes' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="absolute z-[60] left-1/2 -translate-x-1/2 top-10 w-80 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-5 px-1">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Gestionar Talles</span>
                           <button onClick={() => setShowNewAttributeForm(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-error rounded-full transition-all">
                              <XIcon size={18} />
                           </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <input 
                            autoFocus
                            placeholder="Ej: XL, 42..."
                            className="flex-1 h-10 bg-slate-50 border-none rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val) {
                                  const isNumeric = /^\d+(\.\d+)?$/.test(val);
                                  handleAddAttribute(isNumeric ? 'numeric' : 'alpha', val);
                                }
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) {
                                const isNumeric = /^\d+(\.\d+)?$/.test(val);
                                handleAddAttribute(isNumeric ? 'numeric' : 'alpha', val);
                              }
                            }}
                            className="h-10 px-4 bg-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-dark transition-colors"
                          >
                            Añadir
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                           {(sizesToShow as string[]).map((s: string) => (
                              <div key={s} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                 <span className="text-xs font-bold text-slate-700">{s}</span>
                                 {s !== 'U' && (
                                    <button 
                                       onClick={() => handleRemoveAttribute(isNaN(Number(s)) ? 'alpha' : 'numeric', s)}
                                       className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-error transition-all"
                                    >
                                       <XIcon size={14} strokeWidth={3} />
                                    </button>
                                 )}
                              </div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Manual size input */}
                  <div className="flex gap-2 mt-4">
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="Talle personalizado..."
                      className="flex-1 h-10 bg-slate-50 border-none rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.currentTarget;
                          const val = sanitizeNumericSize(input.value);
                          if (val) {
                            const isNumeric = /^\d+(\.\d+)?$/.test(val);
                            const attrType = isNumeric ? 'numeric' : 'alpha';
                            const normalized = normalizeAttributeValue(val);
                            const exists = (dbAttributes[attrType] || []).some(
                              (v: string) => normalizeAttributeValue(v) === normalized
                            );
                            if (!exists) {
                              handleAddAttribute(attrType, val);
                            }
                            setSelectedSizes(prev => prev.includes(val) ? prev : [...prev, val]);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const container = (e.target as HTMLElement).closest('.flex');
                        if (!container) return;
                        const input = container.querySelector('input');
                        if (!input) return;
                        const val = sanitizeNumericSize(input.value);
                        if (val) {
                          const isNumeric = /^\d+(\.\d+)?$/.test(val);
                          const attrType = isNumeric ? 'numeric' : 'alpha';
                          const normalized = normalizeAttributeValue(val);
                          const exists = (dbAttributes[attrType] || []).some(
                            (v: string) => normalizeAttributeValue(v) === normalized
                          );
                          if (!exists) {
                            handleAddAttribute(attrType, val);
                          }
                          setSelectedSizes(prev => prev.includes(val) ? prev : [...prev, val]);
                          input.value = '';
                        }
                      }}
                      className="h-10 px-4 bg-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-dark transition-colors"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {(sizesToShow as string[]).map((size: string) => {
                      const isSelected = selectedSizes.includes(size);
                      return (
                        <div key={size} className="relative group/attr">
                          <button
                            onClick={() => toggleAttribute('sizes', size)}
                            className={`min-w-[50px] h-12 rounded-xl text-xs font-black transition-all border-2 ${
                              isSelected 
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                            }`}
                          >
                            {size}
                          </button>
                          {/* No more red crosses here as per user request */}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Colores */}
                <div className="space-y-6 relative">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2">
                       Colores Disponibles <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[9px]">{selectedColors.length}</span>
                    </label>
                    <button 
                      onClick={() => setShowNewAttributeForm(showNewAttributeForm === 'colors' ? null : 'colors')}
                      className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
                    >
                      {showNewAttributeForm === 'colors' ? 'CANCELAR' : '+ Nuevo Color'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewAttributeForm === 'colors' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="absolute z-[60] left-1/2 -translate-x-1/2 top-10 w-80 bg-white p-5 rounded-[2rem] border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-5 px-1">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Gestionar Colores</span>
                           <button onClick={() => setShowNewAttributeForm(null)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-error rounded-full transition-all">
                              <XIcon size={18} />
                           </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <input 
                            autoFocus
                            placeholder="Nuevo Color..."
                            className="flex-1 h-11 bg-slate-50 border-none rounded-xl px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim();
                                if (val) handleAddAttribute('colors', val);
                              }
                            }}
                          />
                          <button 
                            onClick={(e) => {
                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                              const val = input.value.trim();
                              if (val) handleAddAttribute('colors', val);
                            }}
                            className="h-11 w-11 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                           {[...(dbAttributes.colors || [])].sort().map((color: string) => (
                              <div key={color} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                 <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: getColorCode(color) }} />
                                    <span className="text-xs font-bold text-slate-700">{color}</span>
                                 </div>
                                 <button 
                                    onClick={() => handleRemoveAttribute('colors', color)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-error transition-all"
                                 >
                                    <XIcon size={14} strokeWidth={3} />
                                 </button>
                              </div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="flex flex-wrap gap-3">
                    {[...(dbAttributes.colors || [])].sort().map((color: string) => {
                      const isSelected = selectedColors.includes(color);
                      return (
                        <div key={color} className="relative group/attr">
                          <button
                            onClick={() => toggleAttribute('colors', color)}
                            className={`px-4 h-12 rounded-xl text-xs font-black transition-all border-2 flex items-center gap-3 ${
                              isSelected 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200 scale-105' 
                                : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                          >
                            <div className={`w-3 h-3 rounded-full border border-white/20`} style={{ backgroundColor: getColorCode(color) }} />
                            {color}
                          </button>
                          {/* No more red crosses here as per user request */}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>


          {/* Row 3: SKU Matrix (Full Width) */}
          <section className={`bg-white p-8 lg:p-12 rounded-[3rem] border transition-all shadow-xl flex flex-col min-h-[600px] ${errors.includes('variants') ? 'border-red-500' : 'border-slate-200/60'}`}>
                <div className="flex flex-col gap-4 mb-8">
                   <div className="flex justify-between items-center">
                     <div className="flex flex-col">
                       <h3 className="text-2xl font-black tracking-tighter text-slate-800 flex items-center gap-3">
                         <Package className="text-primary" size={24} /> Matriz de SKUs
                       </h3>
                       <div className="flex items-center gap-4 mt-2 ml-9">
                          <div className="flex items-center gap-1.5">
                            <Clock size={10} className="text-slate-300" />
                            <span className="text-[10px] font-bold text-slate-400 tracking-widest">
                              {formatDate(product?.created_at || new Date())}
                            </span>
                          </div>
                         <div className="h-1 w-1 rounded-full bg-slate-300" />
                         <span className="text-[10px] font-bold text-primary tracking-widest flex items-center gap-1">
                           <DollarSign size={10} /> Base: {formatCurrency(Number(basePrice))}
                         </span>
                       </div>
                     </div>

                     {/* Instruction 12: Quick Filters in Editor */}
                     <div className="relative group">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                       <input 
                         type="text"
                         placeholder="Filtrar por Talle, Color o SKU..."
                         className="w-72 h-11 bg-slate-100/50 border border-slate-200 rounded-2xl pl-12 pr-4 text-xs font-bold text-slate-600 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm"
                         value={matrixFilter}
                         onChange={(e) => setMatrixFilter(e.target.value)}
                       />
                     </div>
                   </div>
                </div>

                <div className="flex-1 overflow-auto rounded-[2rem] border border-slate-100 bg-slate-50/30 backdrop-blur-md shadow-inner">
                     <table className="w-full text-left border-separate border-spacing-0 min-w-[1200px]">
                        <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-5 w-[40px]">
                              <button 
                                onClick={() => toggleAllSelection(variants.filter(v => {
                                  const search = matrixFilter.toLowerCase();
                                  return v.color.toLowerCase().includes(search) || 
                                         v.size.toLowerCase().includes(search) || 
                                         v.sku.toLowerCase().includes(search);
                                }))}
                                className="text-slate-400 hover:text-primary transition-colors"
                              >
                                {selectedVariantIds.size > 0 ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                              </button>
                            </th>
                            <th className="px-6 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Color</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Talle</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">SKU Gen</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Stock Act.</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Stock Mín.</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Costo</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-primary text-right">Efectivo</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Débito</th>
                            <th className="px-4 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Crédito</th>
                            <th className="px-6 py-5 w-[60px]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                           <AnimatePresence mode="popLayout">
                           {variants
                             .filter(v => {
                               const search = matrixFilter.toLowerCase();
                               return v.color.toLowerCase().includes(search) || 
                                      v.size.toLowerCase().includes(search) || 
                                      v.sku.toLowerCase().includes(search);
                             })
                             .sort((a, b) => {
                               const colorCompare = a.color.localeCompare(b.color, undefined, { sensitivity: 'base' });
                               if (colorCompare !== 0) return colorCompare;
                               return compareSizes(a.size, b.size);
                             })
                             .map((v) => (
                                <motion.tr 
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  key={v.id} 
                                  className={`hover:bg-white transition-colors group relative ${selectedVariantIds.has(v.id) ? 'bg-primary/5' : ''}`}
                                >
                                   <td className="px-6 py-4">
                                      <button 
                                        onClick={() => toggleSelection(v.id)}
                                        className={`${selectedVariantIds.has(v.id) ? 'text-primary' : 'text-slate-200 group-hover:text-slate-400'} transition-colors`}
                                      >
                                        {selectedVariantIds.has(v.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                      </button>
                                   </td>
                                   <td className="px-6 py-4">
                                      <div className="flex items-center gap-2.5">
                                        <span className="w-4 h-4 rounded-full bg-slate-800 border-2 border-white shadow-sm ring-1 ring-slate-100" />
                                        <span className="text-xs font-black text-slate-700 tracking-tight">{v.color}</span>
                                      </div>
                                   </td>
                                   <td className="px-4 py-4 text-center">
                                      <span className="inline-flex items-center justify-center min-w-[32px] h-8 bg-primary/10 text-primary text-[10px] font-black rounded-lg border border-primary/10">
                                        {v.size}
                                      </span>
                                   </td>
                                   <td className="px-4 py-4">
                                      <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-slate-400 transition-colors">
                                        <Barcode size={12} />
                                        <span className="text-[10px] font-mono font-bold tracking-tighter">{v.sku}</span>
                                      </div>
                                   </td>
                                   <td className="px-4 py-4">
                                      <div className="relative group/input flex justify-center">
                                        <input 
                                         type="text"
                                         inputMode="numeric"
                                         className="w-20 h-10 bg-white border border-slate-200 text-sm font-black text-slate-800 rounded-xl px-2 text-center focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm group-hover/input:border-slate-300"
                                         value={v.stock}
                                         onChange={(e) => updateVariant(v.id, 'stock', e.target.value)}
                                         onKeyDown={(e) => handleVariantKeyDown(e, v.id, 'stock', v.stock)}
                                        />
                                        {Number(v.stock) <= Number(v.stockMinimo) && Number(v.stock) > 0 && (
                                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-white animate-pulse" />
                                        )}
                                      </div>
                                   </td>
                                   <td className="px-4 py-4">
                                      <div className="flex justify-center">
                                        <input 
                                          type="text"
                                          inputMode="numeric"
                                          className="w-16 h-10 bg-slate-50/50 border border-slate-100 text-xs font-bold text-slate-500 rounded-xl px-2 text-center focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 outline-none transition-all shadow-inner"
                                          value={v.stockMinimo}
                                          onChange={(e) => updateVariant(v.id, 'stockMinimo', e.target.value)}
                                          onKeyDown={(e) => handleVariantKeyDown(e, v.id, 'stockMinimo', v.stockMinimo)}
                                        />
                                      </div>
                                   </td>
                                   <td className="px-4 py-4 text-right">
                                      <div className="flex items-center bg-slate-50/50 rounded-xl border border-slate-100 p-1 group-hover:border-slate-200 transition-all">
                                        <span className="text-[9px] font-black text-slate-300 ml-2 mr-1">$</span>
                                        <input 
                                          type="text"
                                          inputMode="decimal"
                                          className="w-20 text-right bg-transparent border-none p-1.5 text-xs font-bold text-slate-600 focus:ring-0"
                                          value={v.cost}
                                          onChange={(e) => updateVariant(v.id, 'cost', e.target.value)}
                                          onKeyDown={(e) => handleVariantKeyDown(e, v.id, 'cost', v.cost)}
                                        />
                                      </div>
                                   </td>
                                   <td className="px-4 py-4 text-right">
                                      <div className="relative">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-primary/40">$</div>
                                        <input 
                                          type="text"
                                          inputMode="decimal"
                                          className="w-24 h-10 text-right bg-primary/5 text-primary border-2 border-primary/10 rounded-xl pl-5 pr-2 text-xs font-black focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all shadow-sm"
                                          value={v.priceCash}
                                          onChange={(e) => updateVariant(v.id, 'priceCash', e.target.value)}
                                          onKeyDown={(e) => handleVariantKeyDown(e, v.id, 'priceCash', v.priceCash)}
                                        />
                                      </div>
                                   </td>
                                   <td className="px-4 py-4 text-right">
                                      <div className="relative">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">$</div>
                                        <input 
                                          type="text"
                                          inputMode="decimal"
                                          className="w-24 h-10 text-right bg-slate-100 text-slate-700 border border-slate-200 rounded-xl pl-5 pr-2 text-xs font-bold focus:border-slate-400 outline-none transition-all"
                                          value={v.priceDebit}
                                          onChange={(e) => updateVariant(v.id, 'priceDebit', e.target.value)}
                                          onKeyDown={(e) => handleVariantKeyDown(e, v.id, 'priceDebit', v.priceDebit)}
                                        />
                                      </div>
                                   </td>
                                   <td className="px-4 py-4 text-right">
                                      <div className="relative">
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">$</div>
                                        <input 
                                          type="text"
                                          inputMode="decimal"
                                          className="w-24 h-10 text-right bg-slate-100 text-slate-700 border border-slate-200 rounded-xl pl-5 pr-2 text-xs font-bold focus:border-slate-400 outline-none transition-all"
                                          value={v.priceCredit}
                                          onChange={(e) => updateVariant(v.id, 'priceCredit', e.target.value)}
                                          onKeyDown={(e) => handleVariantKeyDown(e, v.id, 'priceCredit', v.priceCredit)}
                                        />
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 text-right">
                                      <button 
                                        onClick={() => removeVariant(v.id)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                   </td>
                                </motion.tr>
                             ))}
                           </AnimatePresence>
                           {variants.length === 0 && (
                              <tr>
                                <td colSpan={7} className="py-32 text-center">
                                   <div className="relative inline-block mb-6">
                                     <Package size={64} strokeWidth={1} className="text-slate-200" />
                                     <motion.div 
                                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                                      transition={{ repeat: Infinity, duration: 3 }}
                                      className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" 
                                     />
                                   </div>
                                   <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Matriz Vacía</p>
                                   <p className="text-[10px] font-bold text-slate-400/60 mt-3 max-w-[200px] mx-auto uppercase leading-relaxed">
                                     Seleccione talles y colores para generar automáticamente la grilla de productos
                                   </p>
                                </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                    </div>

                {/* Bulk Actions Bar */}
                {selectedVariantIds.size > 0 && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-8 backdrop-blur-xl border border-white/10"
                  >
                     <div className="flex items-center gap-3 pr-8 border-r border-white/10">
                        <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black">{selectedVariantIds.size} seleccionados</span>
                     </div>
                     
                     <div className="flex items-center gap-2">
                        <button onClick={() => bulkAction('link')} className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-xs font-bold whitespace-nowrap">
                           <Link size={14} /> Vincular Base
                        </button>
                        <button onClick={() => bulkAction('stock_min')} className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-xs font-bold whitespace-nowrap">
                           <Package size={14} /> Aplicar Stock Mín.
                        </button>
                        <button onClick={() => setSelectedVariantIds(new Set())} className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-all text-xs font-bold text-slate-400 whitespace-nowrap">
                           Limpiar
                        </button>
                     </div>
                  </motion.div>
                )}
            </section>
          </div>
      </main>
    </div>
  );
}
