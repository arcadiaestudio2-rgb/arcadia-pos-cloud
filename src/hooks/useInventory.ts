import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { toast } from '../components/common/CommonUI';
import { useOperator } from '../context/OperatorContext';

export interface InventoryItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  color: string;
  size: string;
  stock: number;
  stock_minimo: number;
  cost: number;
  margin: number;
  price_cash: number;
  category: string;
  brand: string;
  season: string;
  isCustom?: boolean;
  price_debit?: number;
  price_credit?: number;
}

export interface InventoryMovement {
  id: number;
  variant_id: number | null;
  quantity: number;
  type: string;
  description: string;
  reason: string;
  created_at: string;
  operator: string;
  timestamp?: string;
  change_amount?: number;
  sku?: string;
  product_name?: string;
  base_product_name?: string; // flat: product name without variant suffix
  size?: string | null;       // flat: talle
  color?: string | null;      // flat: color
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
  id?: string | number;
  name: string;
}

export function useInventory() {
  const { selectedOperator: rawOperator } = useOperator();
  const operator = typeof rawOperator === 'string' 
    ? { id: '0', name: rawOperator } 
    : rawOperator;

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<ProductAttribute[]>([]);
  const [brands, setBrands] = useState<ProductAttribute[]>([]);
  const [seasons, setSeasons] = useState<ProductAttribute[]>([]);
  const [colors, setColors] = useState<ProductAttribute[]>([]);
  
  const [deletedProducts, setDeletedProducts] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

  const loadAttributes = useCallback(async () => {
    try {
      const attrs = await api.getCatalogAttributes();
      if (attrs && typeof attrs === 'object') {
        setCategories(Array.isArray(attrs.categories) ? attrs.categories.map((name: string) => ({ name })) : []);
        setBrands(Array.isArray(attrs.brands) ? attrs.brands.map((name: string) => ({ name })) : []);
        setSeasons(Array.isArray(attrs.seasons) ? attrs.seasons.map((name: string) => ({ name })) : []);
        setColors(Array.isArray(attrs.colors) ? attrs.colors.map((name: string) => ({ name })) : []);
      }
    } catch (err: any) {
      console.error('Error loading attributes:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    try {
      const [itemsData, deletedData, movementsData] = await Promise.all([
        api.getInventoryItems(),
        api.getDeletedInventoryItems(),
        api.getInventoryHistory(PAGE_SIZE, 0),
        loadAttributes()
      ]);
      
      setProducts(Array.isArray(itemsData) ? itemsData : []);
      setDeletedProducts(Array.isArray(deletedData) ? deletedData : []);
      // Ensure movementsData is typed correctly
      setMovements(Array.isArray(movementsData) ? (movementsData as InventoryMovement[]) : []);
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
  }, [loadAttributes]);

  const addAttribute = async (type: 'categories' | 'brands' | 'seasons' | 'colors', name: string) => {
    try {
      await api.addCatalogAttribute(type, name);
      await loadAttributes();
      toast.success(`${name} agregado a ${type}`);
    } catch (err) {
      console.error(`Error adding ${type}:`, err);
      toast.error(`Error al agregar ${name}`);
    }
  };

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

  useEffect(() => {
    refresh();
    
    // Escuchar evento operativo de stock
    const handleStockRefresh = () => {
      console.log("[Inventory] Refrescando dominio de STOCK");
      refresh();
    };

    window.addEventListener('refresh-stock', handleStockRefresh);
    return () => {
      window.removeEventListener('refresh-stock', handleStockRefresh);
    };
  }, [refresh]);

  const updateStock = async (variantId: number, quantity: number, type: 'INGRESO' | 'EGRESO', description: string, reason: string) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    try {
      const operatorName = operator?.name || 'Sistema';
      const userId = Number(operator?.id || 1);
      const finalDescription = description ? `${description} (Op: ${operatorName})` : `Ajuste manual (Op: ${operatorName})`;
      const variant = products.find(p => p.id === variantId);
      await api.updateStock(variantId, quantity, type, finalDescription, reason, userId, variant?.sku);
      
      // Optimistic update
      setProducts(prev => prev.map(p => {
        if (p.id === variantId) {
          const change = type === 'INGRESO' ? Math.abs(quantity) : -Math.abs(quantity);
          return { ...p, stock: Math.max(0, p.stock + change) };
        }
        return p;
      }));

      // Background refresh
      refresh().catch(() => {});
      toast.success('Stock actualizado correctamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar stock');
      throw err;
    }
  };

  const bulkUpdateStock = async (updates: { variantId: number, quantity: number, type: 'INGRESO' | 'EGRESO', reason: string }[]) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    setLoading(true);
    try {
      const operatorName = operator?.name || 'Sistema';
      const userId = Number(operator?.id || 1);
      // Since api doesn't have a single bulk update endpoint for general movements,
      // we execute them in parallel. 
      await Promise.all(updates.map(u => 
        api.updateStock(u.variantId, u.quantity, u.type, `${u.reason} (Op: ${operatorName})`, 'Inventory Update', userId)
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

  const updateProduct = async (id: number, data: any) => {
    try {
      await api.updateProduct(id, data);
      
      // If status changed to deleted, record it in history for all variants
      if (data.status === 'deleted') {
        const product = products.find(p => p.product_id === id);
        const variants = products.filter(p => p.product_id === id);
        
        // Record restoration in history for all variants in parallel to avoid blocking the UI
        await Promise.all(variants.map(variant => 
          api.updateStock(
            variant.id,
            -(variant.stock || 0),
            'EGRESO',
            `Producto eliminado del catálogo: ${product?.name || 'ID: ' + id}`,
            `Baja: Eliminado del catálogo (Op: ${operator?.name || 'Sistema'})`,
            Number(operator?.id) || 0,
            variant.sku
          ).catch(e => console.warn(`[Inventory] Failed to record deletion movement for variant ${variant.id}:`, e))
        ));
      }
      
      await refresh();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar producto');
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

  const updateFinancialData = async (variantId: number, data: { cost: number, margin: number, price_cash: number, price_debit: number, price_credit: number, description: string, reason: string }) => {
    if (!operator) {
      toast.error('Debe seleccionar un operador para realizar esta acción');
      throw new Error('Operador no seleccionado');
    }
    setLoading(true);
    try {
      const item = products.find(p => p.id === variantId);
      if (!item) throw new Error('Producto no encontrado');

      const operatorName = operator?.name || 'Sistema';
      const userId = Number(operator?.id || 1);
      const finalDescription = data.description ? `${data.description} (Op: ${operatorName})` : `Ajuste manual de precios (Op: ${operatorName})`;

      // 1. Update base cost/margin on the products table (lightweight — no full RPC needed)
      let currentInfo = {};
      try {
        const rawInfo = (item as any).provider_info;
        currentInfo = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : (rawInfo || {});
      } catch (e) {
        console.error("Error parsing provider_info:", e);
      }

      const updatePromise = api.updateProduct(item.product_id, {
        cost: data.cost,
        base_margin: data.margin,
        base_price: data.price_cash,
        price_cash: data.price_cash,
        price_debit: data.price_debit,
        price_credit: data.price_credit,
        provider_info: JSON.stringify({
          ...currentInfo,
          manual_prices: {
            efectivo: data.price_cash,
            debito: data.price_debit,
            credito: data.price_credit
          }
        }),
        variants: [{
          id: variantId,
          cost: data.cost,
          margin: data.margin,
          pvp: data.price_cash,
          sku: item.sku // Ensure variant is identified correctly
        }]
      });

      // 2. Record Movement (Audit Log)
      const structuredReason = `EFECTIVO: ${data.price_cash} | DEBITO: ${data.price_debit} | CREDITO: ${data.price_credit} | COSTO: ${data.cost} | MOTIVO: ${data.reason} (Op: ${operatorName})`;
      const logPromise = api.recordMovement({
        variantId,
        userId,
        amount: 0,
        reason: structuredReason,
        eventId: `FIN-${Date.now()}`
      });

      await Promise.all([updatePromise, logPromise]);
      
      // Optimistic Update: Update local state immediately for a smooth UX
      setProducts(prev => prev.map(p => {
        if (p.id === variantId) {
          return {
            ...p,
            cost: data.cost,
            margin: data.margin,
            price_cash: data.price_cash,
            price_debit: data.price_debit,
            price_credit: data.price_credit,
            // Also update the nested provider_info for components that read it directly
            provider_info: JSON.stringify({
              ...currentInfo,
              manual_prices: {
                efectivo: data.price_cash,
                debito: data.price_debit,
                credito: data.price_credit
              }
            })
          };
        }
        return p;
      }));

      // Background refresh to keep everything in sync
      refresh().catch(() => {});
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
    massAdjustPrices,
    updateMarginMassive,
    updateFinancialData,
    // List of products marked as deleted
    deletedProducts,
    restoreProduct: async (id: number) => {
      try {
        await api.updateProduct(id, { status: 'active' });
        
        // Record restoration in history for all variants
        const product = deletedProducts.find(p => p.product_id === id);
        const variants = deletedProducts.filter(p => p.product_id === id);
        
        // Record restoration in history for all variants in parallel
        await Promise.all(variants.map(variant => 
          api.updateStock(
            variant.id,
            0,
            'INGRESO',
            `Producto restaurado al catálogo: ${product?.name || 'ID: ' + id}`,
            `Alta: Restaurado al catálogo (Op: ${operator?.name || 'Sistema'})`,
            Number(operator?.id) || 0,
            variant.sku
          ).catch(e => console.warn(`[Inventory] Failed to record restoration movement for variant ${variant.id}:`, e))
        ));
        
        await refresh();
        toast.success('Producto restaurado');
      } catch (err: any) {
        toast.error(err.message || 'Error al restaurar producto');
      }
    },
    categories,
    brands,
    seasons,
    colors,
    addAttribute,
    annulSession: async (session: { evento_id?: string | null; movements: any[] }) => {
      if (!operator) {
        toast.error('Debe seleccionar un operador para realizar esta acción');
        throw new Error('Operador no seleccionado');
      }
      setLoading(true);
      try {
        const operatorName = operator?.name || 'Sistema';
        const userId = Number(operator?.id || 1);
        const result = await api.annulMovementsBatch(
          session.movements,
          operatorName,
          userId,
          session.evento_id ?? null
        );
        await refresh();
        toast.success(`Operación anulada — ${result.reversed} movimiento(s) revertido(s)`);
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
