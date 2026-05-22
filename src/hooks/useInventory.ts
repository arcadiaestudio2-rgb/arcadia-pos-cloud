import { useState, useEffect, useCallback } from 'react';
import { UUID } from '../types/uuid';
import { api } from '../services/api';
import { toast } from '../components/common/CommonUI';
import { useOperator } from '../hooks/useOperator';

export interface InventoryItem {
  id: UUID;
  productId?: UUID;
  name: string;
  sku: string;
  color: string;
  size: string;
  stock: number;
  stockMinimo: number;
  cost: number;
  margin: number;
  priceCash: number;
  priceDebit: number;
  priceCredit: number;
  category: string;
  brand: string;
  season: string;
  isCustom?: boolean;
  providerInfo?: any;
  basePrice?: number;
  baseMargin?: number;
  baseCost?: number;
}

export interface InventoryMovement {
  id: string; 
  variant_id: string | null;
  quantity: number;
  type: string;
  description: string;
  reason: string;
  created_at: string;
  operator: string;
  
  change_amount?: number;
  sku?: string;
  product_name?: string;
  base_product_name?: string;
  size?: string | null;
  color?: string | null;
  event_id?: string;
  inventory_items?: {
    sku: string;
    size?: string;
    color?: string;
    products?: {
      name: string;
    }
  };
}

export interface ProductAttribute {
  id?: string;
  name: string;
}

export function useInventory() {
  const { selectedOperator: rawOperator } = useOperator();
  const operator = typeof rawOperator === 'string' 
    ? { id: '0', name: rawOperator } 
    : rawOperator;

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [deletedProducts, setDeletedProducts] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attributes, setAttributes] = useState<{ categories: string[], brands: string[], seasons: string[], colors: string[] }>({
    categories: [],
    brands: [],
    seasons: [],
    colors: []
  });
  const PAGE_SIZE = 50;


  const refresh = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    try {
      const [itemsData, deletedData, movementsData, attrs] = await Promise.all([
        api.getInventoryItems(),
        api.getDeletedInventoryItems(),
        api.getInventoryHistory(PAGE_SIZE, 0),
        api.getCatalogAttributes()
      ]);

      if (attrs) {
        setAttributes({
          categories: attrs.categories || [],
          brands: attrs.brands || [],
          seasons: attrs.seasons || [],
          colors: attrs.colors || []
        });
      }
      
      const mapItem = (v: any) => ({
        ...v,
        id: v.id,
        productId: v.productId || v.product_id,
        priceCash: v.priceCash || v.price_cash || 0,
        priceDebit: v.priceDebit || v.price_debit || 0,
        priceCredit: v.priceCredit || v.price_credit || 0,
        stockMinimo: v.stockMinimo || v.stock_minimo || 0,
        name: v.name || v.products?.name || 'Producto'
      });

      setProducts((itemsData || []).map(mapItem));
      setDeletedProducts(Array.isArray(deletedData) ? deletedData.map(mapItem) : []);
      // Ensure movementsData is typed correctly
      setMovements(Array.isArray(movementsData) ? movementsData.map((m: any) => ({
        ...m,
        id: m.id,
        variant_id: m.variant_id || m.variant_uuid
      })) : []);
      if (movementsData.length < PAGE_SIZE) setHasMore(false);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      // Fallback a array vacío para no bloquear la UI
      setProducts([]);
      setDeletedProducts([]);
      setMovements([]);
      setError(err.message || 'Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }, []);


  const loadMoreMovements = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    
    setLoadingMore(true);
    try {
      const newOffset = offset + PAGE_SIZE;
      const moreMovements = await api.getInventoryHistory(PAGE_SIZE, newOffset);
      if (moreMovements.length < PAGE_SIZE) setHasMore(false);
      setMovements(prev => [...prev, ...moreMovements] as InventoryMovement[]);
      setOffset(newOffset);
    } catch (err: any) {
      console.error('Error loading more movements:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, offset]);


  // 1. Fetch initial data
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 2. Local events listeners
  useEffect(() => {
    window.addEventListener('refresh-stock', refresh);
    window.addEventListener('refresh-attributes', refresh);
    return () => {
      window.removeEventListener('refresh-stock', refresh);
      window.removeEventListener('refresh-attributes', refresh);
    };
  }, [refresh]);

  // --- REALTIME IDEMPOTENT SYNC ---
  useEffect(() => {
    const handleSync = () => {
      console.log("🔄 [REALTIME] Refreshing inventory from sync event");
      refresh();
    };

    window.addEventListener('arcadia:inventory:sync', handleSync);

    return () => {
      window.removeEventListener('arcadia:inventory:sync', handleSync);
    };
  }, [refresh]);

  const updateStock = async (variantId: UUID, quantity: number, type: 'INGRESO' | 'EGRESO', description: string, reason: string) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    try {
      if (!operator?.id) throw new Error("ID de operador no válido");
      const userId = operator.id.toString();
      
      const finalReason = description ? `${reason}: ${description}` : reason;
      
      // Llamar a la API con el nuevo contrato de 5 parámetros
      await api.updateStock(variantId, quantity, type, finalReason, userId);
      
      // Optimistic update
      setProducts(prev => prev.map(p => {
        if (p.id === variantId) {
          const change = type === 'INGRESO' ? Math.abs(quantity) : -Math.abs(quantity);
          return { ...p, stock: Math.max(0, p.stock + change) };
        }
        return p;
      }));

      // Background refresh and notify other components
      refresh().catch(() => {});
      window.dispatchEvent(new CustomEvent('refresh-stock'));
      toast.success('Stock actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar stock');
      throw err;
    }
  };

  const bulkUpdateStock = async (updates: { variantId: string, quantity: number, type: 'INGRESO' | 'EGRESO', reason: string }[]) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    setLoading(true);
    try {
      if (!operator?.id) throw new Error("ID de operador no válido");
      const userId = operator.id.toString();
      // Since api doesn't have a single bulk update endpoint for general movements,
      // we execute them in parallel. 
      await Promise.all(updates.map(u => 
        api.updateStock(u.variantId, u.quantity, u.type, u.reason, userId)
      ));
      await refresh();
      toast.success('Actualización masiva completada');
    } catch (err: any) {
      console.error('Error in bulk update:', err);
      toast.error('Error en la actualización masiva');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (id: string, data: any) => {
    try {
      await api.updateProduct(id, data);
      
      // If status changed to deleted, record it in history for all variants
      if (data.status === 'deleted') {
        const variants = products.filter(p => p.productId === id);
        
        // Record restoration in history for all variants in parallel to avoid blocking the UI
        await Promise.all(variants.map(variant => 
          api.updateStock(
            variant.id,
            -(variant.stock || 0),
            'EGRESO',
            `Baja: Eliminado del catálogo (Op: ${operator?.name || 'Sistema'})`,
            operator?.id?.toString() || 'system'
          ).catch(e => console.warn(`[Inventory] Failed to record deletion movement for variant ${variant.id}:`, e))
        ));
      }
      
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar producto');
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      toast.success('Producto eliminado del catálogo');
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar producto');
      throw err;
    }
  };

  const massAdjustPrices = async (percentage: number) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    setLoading(true);
    try {
      await api.massPriceAdjust(percentage);
      await refresh();
      toast.success('Precios actualizados masivamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al ajustar precios');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateMarginMassive = async (newMargin: number) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    setLoading(true);
    try {
      await api.massMarginAdjust(newMargin);
      await refresh();
      toast.success('Margen actualizado masivamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al ajustar margen');
    } finally {
      setLoading(false);
    }
  };

  const updateFinancialData = async (variantId: UUID, data: { cost: number, margin: number, priceCash: number, priceDebit: number, priceCredit: number, description: string, reason: string }) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    setLoading(true);
    try {
      const item = products.find(p => String(p.id) === String(variantId));
      if (!item) throw new Error('Producto no encontrado');

      if (!operator?.id) throw new Error("ID de operador no válido");
      // 1. Update base cost/margin on the products table (lightweight — no full RPC needed)
      let currentInfo = {};
      try {
        const rawInfo = (item as any).providerInfo;
        currentInfo = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : (rawInfo || {});
      } catch (e) {
        console.error("Error parsing provider_info:", e);
      }

      // 1. Actualizar solo campos financieros del producto base
      if (!item.productId) {
        throw new Error("ID de producto base no encontrado. Esta variante podría estar huérfana o ser legacy.");
      }

      const updatePromise = api.updateProduct(item.productId, {
        cost: data.cost,
        baseMargin: data.margin,
        priceCash: data.priceCash,
        providerInfo: JSON.stringify({
          ...currentInfo,
          manual_prices: {
            efectivo: data.priceCash,
            debito: data.priceDebit,
            credito: data.priceCredit
          }
        })
      });

      // 2. Actualizar la variante específica (pvp, cost, margin)
      const variantUpdatePromise = api.updateVariant(variantId, {
        cost: data.cost,
        margin: data.margin,
        priceCash: data.priceCash,
        priceDebit: data.priceDebit,
        priceCredit: data.priceCredit
      });

      // 3. Los logs se generan automáticamente en la DB vía adjust_stock
      // Si solo es un cambio de precio, no llamamos a adjust_stock.
      
      await Promise.all([updatePromise, variantUpdatePromise]);
      
      // Optimistic Update: Update local state immediately for a smooth UX
      setProducts(prev => prev.map(p => {
        if (String(p.id) === String(variantId)) {
          return {
            ...p,
            cost: data.cost,
            margin: data.margin,
            priceCash: data.priceCash,
            priceDebit: data.priceDebit,
            priceCredit: data.priceCredit,
            // Also update the nested providerInfo for components that read it directly
            providerInfo: JSON.stringify({
              ...currentInfo,
              manual_prices: {
                efectivo: data.priceCash,
                debito: data.priceDebit,
                credito: data.priceCredit
              }
            })
          };
        }
        return p;
      }));

      // Background refresh to keep everything in sync
      refresh().catch(() => {});
      window.dispatchEvent(new CustomEvent('refresh-stock'));
      toast.success('Datos financieros actualizados y auditados');
    } catch (err: any) {
      console.error('Error updating financial data:', err);
      toast.error(err.message || 'Error al actualizar datos financieros');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    products,
    movements,
    loading,
    error,
    refresh,
    loadMoreMovements,
    getProductById: api.getProductById,
    hasMore,
    loadingMore,
    updateStock,
    bulkUpdateStock,
    updateProduct,
    deleteProduct,
    massAdjustPrices,
    updateMarginMassive,
    updateFinancialData,
    // List of products marked as deleted
    deletedProducts,
    attributes,
    restoreProduct: async (id: string) => {
      try {
        await api.updateProduct(id, { status: 'active' });
        
        // Record restoration in history for all variants
        const variants = deletedProducts.filter(p => p.productId === id);
        
        // Record restoration in history for all variants in parallel
        await Promise.all(variants.map(variant => 
          api.updateStock(
            variant.id,
            0,
            'INGRESO',
            `Alta: Restaurado al catálogo (Op: ${operator?.name || 'Sistema'})`,
            operator?.id?.toString() || 'system'
          ).catch(e => console.warn(`[Inventory] Failed to record restoration movement for variant ${variant.id}:`, e))
        ));
        
        await refresh();
        toast.success('Producto restaurado');
      } catch (err: any) {
        toast.error(err.message || 'Error al restaurar producto');
      }
    },
    annulSession: async (session: { evento_id?: string | null; movements: any[] }) => {
      if (!operator) {
        toast.error('Debe seleccionar un operador para realizar esta acción');
        throw new Error('Operador no seleccionado');
      }
      setLoading(true);
      try {
        const operatorName = operator?.name || 'Sistema';
        await api.annulMovementsBatch(
          session.movements,
          operatorName,
          operator.id.toString(),
          session.evento_id ?? null
        );
        await refresh();
        toast.success(`Operación anulada`);
        return true;
      } catch (err: any) {
        toast.error(err.message || 'Error al anular la operación');
        return false;
      } finally {
        setLoading(false);
      }
    }
  };
}
