import React from 'react';
import { Search } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: any[];
  onAddToCart: (product: any) => void;
  isLoading?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, onAddToCart, isLoading }) => {
  const [activeProductId, setActiveProductId] = React.useState<string | null>(null);

  // Group products by product_id (parent product)
  const groupedProducts = React.useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    products.forEach(p => {
      // Use product_id for grouping variants of the same product
      const key = p.product_id || p.id; 
      
      // Parse manual price overrides from provider_info
      let overridePrices = { cash: 0, debit: 0, credit: 0 };
      try {
        const rawInfo = p.provider_info || p.products?.provider_info;
        if (rawInfo && String(rawInfo) !== "[object Object]") {
          const pInfo = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
          if (pInfo && pInfo.manual_prices) {
            overridePrices = {
              cash: Number(pInfo.manual_prices.efectivo) || 0,
              debit: Number(pInfo.manual_prices.debito || pInfo.manual_prices.debit) || 0,
              credit: Number(pInfo.manual_prices.credito || pInfo.manual_prices.credit) || 0
            };
          }
        }
      } catch (e) {}

      const baseCash = overridePrices.cash || p.pvp || p.price || 0;
      const baseDebit = overridePrices.debit || baseCash;
      const baseCredit = overridePrices.credit || baseCash;

      if (!groups[key]) {
        groups[key] = {
          ...p,
          id: key, 
          minPrice: baseCash,
          maxPrice: baseCash,
          totalStock: 0,
          variants: [],
          // Payment specific prices for the display card
          displayPrices: {
            cash: baseCash,
            debit: baseDebit,
            credit: baseCredit
          }
        };
      }
      
      groups[key].totalStock += (p.stock || 0);
      groups[key].minPrice = Math.min(groups[key].minPrice, baseCash);
      groups[key].maxPrice = Math.max(groups[key].maxPrice, baseCash);
      
      // Store the variant in the list
      groups[key].variants.push({
        ...p,
        prices: {
          cash: baseCash,
          debit: baseDebit,
          credit: baseCredit
        }
      });
    });
    
    const processedGroups = Object.values(groups);
    
    return processedGroups;
  }, [products]);

  return (
    <div className="p-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        <AnimatePresence mode="popLayout">
          {groupedProducts.length > 0 ? (
            groupedProducts.map((p, idx) => (
              <ProductCard 
                key={p.id} 
                product={p} 
                onAdd={onAddToCart} 
                index={idx} 
                activeProductId={activeProductId}
                onOpenModal={() => setActiveProductId(p.id)}
                onCloseModal={() => setActiveProductId(null)}
              />
            ))
          ) : !isLoading && (
            <div className="col-span-full py-20 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-white/20 mb-4">
                <Search size={28} />
              </div>
              <h3 className="text-[14px] font-black text-white/20 uppercase tracking-widest">Sin Resultados</h3>
              <p className="text-[10px] font-bold text-white/10 uppercase mt-2">Intenta con otro término o categoría</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
