import React, { useState, useMemo, useEffect } from 'react';
import { 
  Info, 
  ShoppingBag,
  X,
  CreditCard,
  Banknote,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, formatCurrency } from '../common/CommonUI';
import { createPortal } from 'react-dom';

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
  
  const aNum = parseFloat(a.split('/')[0].replace(/[^0-9.]/g, ''));
  const bNum = parseFloat(b.split('/')[0].replace(/[^0-9.]/g, ''));
  
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }
  
  return a.localeCompare(b);
};

// Premium Minimalist Category Icons
const ShirtIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.62 1.96V10a2 2 0 002 2h2v10h12V12h2a2 2 0 002-2V5.42a2 2 0 00-1.62-1.96z" />
    <path d="M12 22V12" />
    <path d="M12 6a2 2 0 100-4 2 2 0 000 4z" />
  </svg>
);

const TrousersIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 3h12l2 18-4.5-1-1.5-7-1.5 7-4.5 1L6 3z" />
    <path d="M12 3v11" />
  </svg>
);

const DressIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2c-.667 1-1.5 2-2 4s-.5 4-1 6l-3 10h12l-3-10c-.5-2-.5-4-1-6s-1.333-3-2-4z" />
    <path d="M9 6h6" />
    <path d="M12 2v4" />
  </svg>
);

const ShoeIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 11h6l1 1h4l5-2v3c0 2-2 5-7 5H4c-1 0-2-1-2-2V13c0-1 1-2 2-2z" />
    <path d="M15 12V8a2 2 0 00-2-2H9a2 2 0 00-2 2v3" />
  </svg>
);

const HoodieIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2a4 4 0 00-4 4v1h8V6a4 4 0 00-4-4z" />
    <path d="M20.38 8.46L16 7a4 4 0 01-8 0l-4.38 1.46a2 2 0 00-1.62 1.96V15a2 2 0 002 2h2v5h12v-5h2a2 2 0 002-2v-4.58a2 2 0 00-1.62-1.96z" />
    <path d="M10 12h4" />
  </svg>
);

const UnderwearIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 5h18v4c0 5-4 10-9 10s-9-5-9-10V5z" />
    <path d="M12 5v14" />
    <path d="M3 9h18" />
  </svg>
);

const WatchIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="7" />
    <polyline points="12 9 12 12 13.5 13.5" />
    <path d="M16.51 7.49l.75-2.25A2 2 0 0015.35 2.5l-1.35.45" />
    <path d="M7.49 16.51l-.75 2.25a2 2 0 001.91 2.74l1.35-.45" />
  </svg>
);

const HangerIcon = ({ size = 24, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 7c-1.5 0-2-1-2-2a2 2 0 114 0c0 1-.5 2-2 2z" />
    <path d="M2 19l10-12 10 12H2z" />
  </svg>
);

interface Product {
  variant_id: string;
  product_id: string;
  name: string;
  image?: string;
  category?: string;
  price_at_sale: number;
  priceCash?: number;
  priceDebit?: number;
  priceCredit?: number;
  pvp?: number;
  stock: number;
  size?: string;
  color?: string;
  
  // Legacy support for older references
  variantId?: string;
  productId?: string;
}

interface GroupedProduct extends Product {
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  variants: Product[];
  displayPrices: {
    cash: number;
    debit: number;
    credit: number;
  };
}

export interface ProductCardProps {
  product: GroupedProduct;
  onAdd: (product: Product) => void;
  activeProductId?: string | null;
  onOpenModal?: () => void;
  onCloseModal?: () => void;
}

export const CATEGORY_VISUALS: Record<string, { bg: string; color: string; icon: any }> = {
  'CALZADO': { bg: 'bg-orange-50', color: 'text-orange-500', icon: ShoeIcon },
  'BUZOS': { bg: 'bg-indigo-50', color: 'text-indigo-500', icon: HoodieIcon },
  'REMERAS': { bg: 'bg-sky-50', color: 'text-sky-500', icon: ShirtIcon },
  'PANTALONES': { bg: 'bg-blue-50', color: 'text-blue-500', icon: TrousersIcon },
  'VESTIDOS': { bg: 'bg-rose-50', color: 'text-rose-500', icon: DressIcon },
  'ROPA_INTERIOR': { bg: 'bg-violet-50', color: 'text-violet-500', icon: UnderwearIcon },
  'ACCESORIOS': { bg: 'bg-amber-50', color: 'text-amber-500', icon: WatchIcon },
  'DEFAULT': { bg: 'bg-slate-50', color: 'text-slate-500', icon: HangerIcon }
};

export const getCategoryImage = (category: string = '', size: number = 32) => {
  const upperCategory = category?.toUpperCase() || '';
  let key = 'DEFAULT';
  if (upperCategory.includes('CALZADO') || upperCategory.includes('ZAPATILLA')) key = 'CALZADO';
  else if (upperCategory.includes('BUZO') || upperCategory.includes('CAMPERA') || upperCategory.includes('ABRIGO')) key = 'BUZOS';
  else if (upperCategory.includes('REMERA') || upperCategory.includes('CHOMBA')) key = 'REMERAS';
  else if (upperCategory.includes('PANTALON') || upperCategory.includes('JEAN')) key = 'PANTALONES';
  else if (upperCategory.includes('VESTIDO')) key = 'VESTIDOS';
  else if (upperCategory.includes('INTERIOR') || upperCategory.includes('BOXER')) key = 'ROPA_INTERIOR';
  else if (upperCategory.includes('ACCESORIO') || upperCategory.includes('RELOJ')) key = 'ACCESORIOS';

  const visual = CATEGORY_VISUALS[key] || CATEGORY_VISUALS['DEFAULT'];
  const Icon = visual.icon;
  
  return (
    <div className={`w-full h-full rounded-inherit ${visual.bg} flex items-center justify-center ${visual.color} shadow-sm border border-white/50 transform transition-transform group-hover:scale-110 duration-500`}>
      <Icon size={size} style={{ opacity: 0.75 }} />
    </div>
  );
};
export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAdd, 
  activeProductId,
  onOpenModal,
  onCloseModal
}) => {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);
  
  const cardRef = React.useRef<HTMLDivElement>(null);
  const isModalOpen = useMemo(() => {
    return activeProductId !== null && activeProductId !== undefined && String(activeProductId) === String(product.product_id || (product as any).productId);
  }, [activeProductId, product.product_id, (product as any).productId]);

  const hasImage = !!product.image && product.image !== 'https://picsum.photos/seed/product/100/100';

  const colorGroups = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    product.variants.forEach(v => {
      const color = v.color || 'Único';
      if (!groups[color]) groups[color] = [];
      groups[color].push(v);
    });
    return groups;
  }, [product.variants]);

  const totalProductStock = useMemo(() => {
    return product.variants?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
  }, [product.variants]);

  const currentColorStock = useMemo(() => {
    if (!selectedColor) return totalProductStock;
    return colorGroups[selectedColor]?.reduce((acc, v) => acc + (v.stock || 0), 0) || 0;
  }, [selectedColor, colorGroups, totalProductStock]);

  const colors = useMemo(() => {
    return Object.keys(colorGroups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [colorGroups]);
  
  useEffect(() => {
    if (isModalOpen && !selectedColor && colors.length > 0) {
      setSelectedColor(colors[0]);
    } else if (!isModalOpen) {
      setSelectedColor(null);
      setSelectedVariant(null);
    }
  }, [isModalOpen, colors, selectedColor]);


  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (product.totalStock <= 0) {
      toast.error('Este producto está agotado y no puede seleccionarse.');
      return;
    }

    const v = product.variants[0];
    const price = Number(v?.price_at_sale || v?.priceCash || v?.pvp || 0);
    
    if (product.variants.length === 1 && v.stock > 0 && price > 0) {
      // Prepare strictly compliant item
      const itemToAdd = {
        ...v,
        price_at_sale: price
      };
      // Delete legacy keys just in case they slipped in
      delete (itemToAdd as any).variantId;
      delete (itemToAdd as any).productId;
      delete (itemToAdd as any).price;

      onAdd(itemToAdd);
    } else {
      onOpenModal?.();
    }
  };

  const currentVisual = useMemo(() => {
    const upperCategory = product.category?.toUpperCase() || '';
    let key = 'DEFAULT';
    if (upperCategory.includes('CALZADO') || upperCategory.includes('ZAPATILLA')) key = 'CALZADO';
    else if (upperCategory.includes('BUZO') || upperCategory.includes('CAMPERA') || upperCategory.includes('ABRIGO')) key = 'BUZOS';
    else if (upperCategory.includes('REMERA') || upperCategory.includes('CHOMBA')) key = 'REMERAS';
    else if (upperCategory.includes('PANTALON') || upperCategory.includes('JEAN')) key = 'PANTALONES';
    else if (upperCategory.includes('VESTIDOS')) key = 'VESTIDOS';
    else if (upperCategory.includes('INTERIOR') || upperCategory.includes('BOXER')) key = 'ROPA_INTERIOR';
    else if (upperCategory.includes('ACCESORIO') || upperCategory.includes('RELOJ')) key = 'ACCESORIOS';
    return CATEGORY_VISUALS[key] || CATEGORY_VISUALS['DEFAULT'];
  }, [product.category]);

  const priceCash = product.displayPrices?.cash || product.priceCash || 0;
  const priceDebit = product.displayPrices?.debit || product.priceDebit || 0;
  const priceCredit = product.displayPrices?.credit || product.priceCredit || 0;

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)" }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2 }}
        onClick={handleCardClick}
        className="group bg-white rounded-[2rem] p-4 border border-slate-100 hover:border-indigo-500/30 transition-all cursor-pointer select-none flex flex-col h-full relative"
      >
        {/* STOCK BADGE */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-slate-100 flex items-center gap-1.5 z-[10]">
          <div className={`w-1.5 h-1.5 rounded-full ${product.totalStock > 5 ? 'bg-emerald-400' : product.totalStock > 0 ? 'bg-amber-400' : 'bg-rose-400'}`} />
          <span className={`text-[10px] font-black tracking-tight ${product.totalStock > 0 ? 'text-slate-600' : 'text-rose-500'}`}>
            {product.totalStock > 0 ? `${product.totalStock} u.` : 'AGOTADO'}
          </span>
        </div>

        {/* IMAGE / ICON SECTION */}
        <div className="relative h-32 w-full rounded-[1.5rem] overflow-hidden mb-4 bg-slate-50 flex items-center justify-center border border-slate-50 group-hover:border-primary/5 transition-colors">
          {hasImage ? (
            <img 
              src={product.image} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              alt={product.name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full h-full ${currentVisual.bg} flex items-center justify-center ${currentVisual.color}`}>
              {React.createElement(currentVisual.icon, { size: 48, style: { opacity: 0.6 } })}
            </div>
          )}
        </div>

        {/* INFO SECTION */}
        <div className="flex-1 flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 block" style={{ color: currentVisual.color.replace('text-', '') }}>
            {product.category || 'General'}
          </span>
          
          <h4 className="text-[14px] font-black text-slate-900 leading-tight mb-4 line-clamp-2 min-h-[2.4em] font-sans">
            {product.name}
          </h4>
          
          {/* 3 PRICES LIST (Grid View) */}
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center justify-between text-[11px] font-black">
              <span className="text-emerald-700 uppercase tracking-widest text-[10px]">Efectivo</span>
              <span className="text-emerald-900 font-mono tracking-tighter text-[13px]">{formatCurrency(priceCash)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-black">
              <span className="text-blue-700 uppercase tracking-widest text-[10px]">Débito</span>
              <span className="text-blue-900 font-mono tracking-tighter text-[13px]">{formatCurrency(priceDebit)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-black">
              <span className="text-purple-700 uppercase tracking-widest text-[10px]">Crédito</span>
              <span className="text-purple-900 font-mono tracking-tighter text-[13px]">{formatCurrency(priceCredit)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* FLOATING VARIANT SELECTOR MODAL */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <>
              <div 
                className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseModal?.();
                }}
              />
              <motion.div
                key="variant-modal"
                style={{
                  top: '50%',
                  left: '50%',
                  x: '-50%',
                  y: '-50%',
                  width: '640px',
                  maxHeight: '90vh',
                  backgroundColor: '#ffffff'
                }}
                initial={{ opacity: 0, scale: 0.9, y: '-40%' }}
                animate={{ opacity: 1, scale: 1, y: '-50%' }}
                exit={{ opacity: 0, scale: 0.9, y: '-40%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed z-[1000] rounded-[2.5rem] p-8 shadow-[0_32px_64px_rgba(0,0,0,0.25)] flex flex-col pointer-events-auto overflow-hidden border border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6 relative">
                  <div className="flex flex-col pr-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      {product.category || 'General'}
                    </span>
                    <h4 className="text-[18px] font-black text-slate-800 leading-tight mt-1 font-sans">
                      {product.name}
                    </h4>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseModal?.();
                    }}
                    className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* 3 PRECIOS SECTION - Row layout for wider modal */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                   {/* Card 1 - Efectivo */}
                   <div className="bg-emerald-500 rounded-2xl p-3 flex flex-col items-center justify-center shadow-lg shadow-emerald-500/10">
                      <div className="flex items-center gap-1.5 mb-1 opacity-80">
                        <Banknote size={14} className="text-white" />
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">Efectivo</span>
                      </div>
                      <span className="text-[15px] font-black text-white font-mono tracking-tighter">
                        {formatCurrency(selectedVariant?.price_at_sale || (product as any).price_at_sale || (product as any).priceCash || 0)}
                      </span>
                   </div>

                   {/* Card 2 - Débito */}
                   <div className="bg-blue-500 rounded-2xl p-3 flex flex-col items-center justify-center shadow-lg shadow-blue-500/10">
                      <div className="flex items-center gap-1.5 mb-1 opacity-80">
                        <Wallet size={14} className="text-white" />
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">Débito</span>
                      </div>
                      <span className="text-[15px] font-black text-white font-mono tracking-tighter">
                        {formatCurrency(selectedVariant?.priceDebit || priceDebit)}
                      </span>
                   </div>

                   {/* Card 3 - Crédito */}
                   <div className="bg-purple-500 rounded-2xl p-3 flex flex-col items-center justify-center shadow-lg shadow-purple-500/10">
                      <div className="flex items-center gap-1.5 mb-1 opacity-80">
                        <CreditCard size={14} className="text-white" />
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">Crédito</span>
                      </div>
                      <span className="text-[15px] font-black text-white font-mono tracking-tighter">
                        {formatCurrency(selectedVariant?.priceCredit || priceCredit)}
                      </span>
                   </div>
                </div>

                {/* Variant Options Section */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
                  {/* Colors */}
                  {colors.length > 0 && (
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3">COLOR</span>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((color) => (
                          <button
                            key={color}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedColor(color);
                              setSelectedVariant(null);
                            }}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${
                              selectedColor === color 
                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-primary/30 hover:text-primary'
                            }`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sizes */}
                  {selectedColor && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block">TALLE / MEDIDA</span>
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={selectedVariant ? 'variant' : 'total'}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-100"
                        >
                          <Info size={12} className="text-blue-500" />
                          <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight">
                            {selectedVariant ? 'Disponibles: ' : 'Total disponible: '}
                            <span className="text-[12px]">{selectedVariant ? selectedVariant.stock : currentColorStock}</span> unidades
                          </span>
                        </motion.div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {colorGroups[selectedColor]?.sort((a, b) => compareSizes(a.size || '', b.size || '')).map((v) => (
                          <button
                            key={v.variant_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (v.stock === 0) {
                                toast.error(`El talle ${v.size || 'Único'} está agotado.`);
                                return;
                              }
                              setSelectedVariant(v);
                            }}
                            className={`py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                              v.stock === 0
                                ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed opacity-40'
                                : selectedVariant?.variant_id === v.variant_id
                                  ? 'border-primary bg-primary text-white font-black shadow-lg shadow-primary/20'
                                  : 'border-slate-100 bg-white text-slate-500 hover:border-primary/30 hover:text-primary'
                            }`}
                          >
                            <span className="text-[13px] font-black">{v.size || 'Único'}</span>
                            <span className="text-[9px] font-bold opacity-60">{v.stock} u.</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <button
                    disabled={!selectedVariant || selectedVariant.stock === 0 || (Number(selectedVariant.priceCash || selectedVariant.pvp || 0) <= 0)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const price = Number(selectedVariant?.price_at_sale || selectedVariant?.priceCash || selectedVariant?.pvp || 0);
                      if (selectedVariant && selectedVariant.stock > 0 && price > 0) {
                        // Prepare strictly compliant item
                        const itemToAdd = {
                          ...selectedVariant,
                          price_at_sale: price
                        };
                        // Delete legacy keys
                        delete (itemToAdd as any).variantId;
                        delete (itemToAdd as any).productId;
                        delete (itemToAdd as any).price;

                        onAdd(itemToAdd);
                        onCloseModal?.();
                      } else if (price <= 0) {
                        toast.error("Este producto no tiene un precio válido");
                      }
                    }}
                    className={`w-full py-4 rounded-[1.5rem] flex items-center justify-center gap-3 text-[14px] font-black uppercase tracking-widest transition-all ${
                      !selectedVariant || selectedVariant.stock === 0 || (Number(selectedVariant.price_at_sale || selectedVariant.priceCash || selectedVariant.pvp || 0) <= 0)
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-primary text-white hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-primary/20'
                    }`}
                  >
                    <ShoppingBag size={18} />
                    <span>{Number(selectedVariant?.priceCash || selectedVariant?.pvp || 0) <= 0 ? 'Sin Precio' : 'Añadir al Carrito'}</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default ProductCard;
