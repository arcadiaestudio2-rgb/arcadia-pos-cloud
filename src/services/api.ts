import { supabase } from '../lib/supabase';
import { getLocalISODate } from '../utils/format';
import { LocalRepository } from '../db/repository';
import { db } from '../db/database';
import { validateSyncPayload, isUUID } from '../utils/validation';
import { UUID } from '../types/uuid';
import { mappers } from '../utils/mappers';

const PRODUCT_SELECT = 'id, name, category, brand, season, barcode, iva_rate, base_price, cost, base_margin, provider_info, status';
const VARIANT_SELECT = 'id, product_id, sku, size, color, stock, stock_minimo, cost, margin, pvp, debit_price, credit_price, is_custom';

/**
 * REGLA DE ORO: El StoreID es SIEMPRE el UID del usuario autenticado en Supabase.
 */
export const getCurrentStoreId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

export const api = {
  supabase,
  getCurrentStoreId,
  generateId: () => crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,

  // HELPER: Limpiar objetos para evitar errores de columnas inexistentes o undefined
  _removeUndefined: (obj: Record<string, any>) => {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value !== undefined)
    );
  },

  login: async (email: string, pass: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) throw error;

      if (data && data.user) {
        // Al loguearse, el store_id es su propio ID de usuario
        return {
          id: data.user.id,
          name: data.user.email?.split('@')[0] || 'Usuario',
          email: data.user.email || '',
          role: 'admin',
          store_id: data.user.id
        };
      }
      throw new Error("No se pudo obtener la información del usuario.");
    } catch (e: any) {
      console.error("🚨 Error de Login:", e.message);
      throw new Error(e.message || "Error de conexión con Supabase");
    }
  },

  // --- REST API METHODS ---
  // --- UNIFIED UPDATE SERVICE (Source of Truth) ---
  unifiedProductUpdate: async (id: UUID, data: any) => {
    if (!isUUID(id)) throw new Error("Invalid Product UUID");
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    // 0. Obtener estado ANTERIOR para el historial de precios
    const { data: oldProd } = await supabase
      .from('products')
      .select('*, variants(id, cost, margin, pvp, sku)')
      .eq('id', id)
      .eq('store_id', storeId)
      .single();

    // 1. Sanitizar payload principal
    const payload = mappers.mapProductToDB({ ...data, storeId });
    
    // 2. Sincronizar provider_info (Precios Maestros)
    let info = payload.provider_info || {};
    if (typeof info === 'string') {
      try { info = JSON.parse(info); } catch (e) { info = {}; }
    }
    
    // Asegurar que manual_prices esté actualizado
    payload.provider_info = {
      ...info,
      manual_prices: {
        efectivo: Number(payload.base_price) || info.manual_prices?.efectivo || 0,
        debito: Number(data.priceDebit || info.manual_prices?.debito || 0),
        credito: Number(data.priceCredit || info.manual_prices?.credito || 0)
      }
    };

    // 3. Actualizar Producto en DB
    const { data: updatedProduct, error: pError } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .eq('store_id', storeId)
      .select()
      .single();

    if (pError) throw pError;

    // 4. Sincronizar Variantes (Precios por SKU)
    const variantsToUpdate = data.variants || [];
    
    if (variantsToUpdate.length > 0) {
      // Split new vs existing variants
      const newVariants = variantsToUpdate.filter((v: any) => 
        !v.id || String(v.id).startsWith("new-")
      );
      const existingVariants = variantsToUpdate.filter((v: any) => 
        v.id && !String(v.id).startsWith("new-")
      );

      // Sanitize and Insert NEW Variants
      if (newVariants.length > 0) {
        const cleanNew = newVariants.map((v: any) => {
          const dbVariant = mappers.mapVariantToDB({ ...v, storeId });
          // Ensure id and product_id are REMOVED from the payload object itself
          // BUT for INSERT we MUST include product_id to maintain relational integrity
          return { ...dbVariant, product_id: id };
        });

        const { error: insertError } = await supabase
          .from('variants')
          .insert(cleanNew);

        if (insertError) throw insertError;
      }

      // Sanitize and Update EXISTING Variants
      if (existingVariants.length > 0) {
        for (const v of existingVariants) {
          const dbVariant = mappers.mapVariantToDB({ ...v, storeId });
          const variantId = dbVariant.id;
          
          // REMOVE product_id and id from the update payload
          const { id: _, product_id: __, ...updatePayload } = dbVariant;

          const { error: updateError } = await supabase
            .from('variants')
            .update(updatePayload)
            .eq('id', variantId)
            .eq('store_id', storeId);

          if (updateError) throw updateError;
        }
      }
    } else {
      await supabase
        .from('variants')
        .update({ 
           pvp: Number(payload.base_price),
           cost: Number(payload.cost),
           margin: Number(payload.base_margin)
        })
        .eq('product_id', id)
        .eq('store_id', storeId);
    }

    // 5. Historial de precios (opcional, para auditoría)
    if (oldProd) {
      const oldPrices = api._mapPrices(oldProd);
      const newPrices = {
        priceCash: payload.base_price,
        priceDebit: payload.provider_info.manual_prices.debito,
        priceCredit: payload.provider_info.manual_prices.credito
      };

      const hasChanges = oldPrices.priceCash !== newPrices.priceCash || 
                         oldPrices.priceDebit !== newPrices.priceDebit || 
                         oldPrices.priceCredit !== newPrices.priceCredit;

      if (hasChanges) {
        console.log('[Price Sync] Detected price change for product:', id);
      }
    }
    // 6. Update Local Mirror (Dexie) to ensure UI reflects changes immediately
    try {
      // Re-fetch everything from Supabase for this product to get the ground truth
      const { data: freshProd } = await supabase
        .from('products')
        .select(`*, variants(*)`)
        .eq('id', id)
        .single();
        
      if (freshProd) {
        const { variants: freshVariants, ...prodFields } = freshProd;
        await LocalRepository.upsertProducts([prodFields]);
        if (freshVariants && freshVariants.length > 0) {
          await LocalRepository.upsertVariants(freshVariants);
        }
      }
    } catch (mirrorError) {
      console.warn("⚠️ [unifiedProductUpdate] Failed to update local mirror:", mirrorError);
    }

    // 7. Trigger UI Refresh
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return updatedProduct;
  },

  updateInventoryItem: async (id: string, data: any) => {
    return api.unifiedProductUpdate(id, {
      ...data,
      updateReason: data.reason || 'Actualización de Inventario'
    });
  },

  _mapPrices: (v: any) => {
    let mDebit = 0;
    let mCredit = 0;
    let mEfectivo = v.pvp || v.base_price || 0;

    try {
      const rawInfo = v.products?.provider_info || v.provider_info || (v as any).product?.provider_info;

      if (rawInfo && String(rawInfo) !== "[object Object]") {
        try {
          const info = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
          const isCorrupt = info && typeof info === 'object' && Object.keys(info).length > 0 && Object.keys(info).every(k => !isNaN(Number(k)));

          if (info && typeof info === 'object' && !Array.isArray(info) && !isCorrupt) {
            if (info.manual_prices) {
              mDebit = Number(info.manual_prices.debito || info.manual_prices.debit) || 0;
              mCredit = Number(info.manual_prices.credito || info.manual_prices.credit) || 0;
              if (info.manual_prices.efectivo) mEfectivo = Number(info.manual_prices.efectivo);
            }
          }
        } catch (e) {
          console.warn("Error parsing provider_info:", e);
        }
      }
    } catch (e) {
      console.warn("Error mapping prices:", e);
    }

    return {
      priceCash: Number(mEfectivo) || 0,
      priceDebit: Number(mDebit) || 0,
      priceCredit: Number(mCredit) || 0
    };
  },

  fetchStats: async () => {
    try {
      const storeId = await getCurrentStoreId();
      if (!storeId) return { revenue: 0, cost: 0, ar: 0, topSeller: { name: '-', sales: 0, revenue: 0 }, productsCount: 0, criticalStock: [], agingDebtors: [], deadStock: [] };

      const today = getLocalISODate();

      const [salesResult, variantsResult, productsResult, debtorsResult] = await Promise.all([
        supabase.from('sales').select('total').eq('store_id', storeId).gte('created_at', `${today}T00:00:00`),
        supabase.from('variants').select('stock, stock_minimo, cost, product_id, sku').eq('store_id', storeId),
        supabase.from('products').select('id, name').eq('store_id', storeId).neq('status', 'deleted'),
        supabase.from('clients').select('name, debt_balance').eq('store_id', storeId).gt('debt_balance', 0).order('debt_balance', { ascending: false }).limit(5)
      ]);

      const revenue = salesResult.data?.reduce((acc, s) => acc + (s.total || 0), 0) || 0;
      const productsMap = new Map((productsResult.data || []).map(p => [p.id, p.name]));

      const criticalStock = (variantsResult.data || [])
        .filter(v => v.stock <= v.stock_minimo && v.stock_minimo > 0)
        .map(v => {
          if (!v.product_id) return null;
          return {
            sku: v.sku,
            name: productsMap.get(v.product_id) || 'Producto',
            stock: v.stock,
            min: v.stock_minimo
          };
        })
        .filter((v): v is any => v !== null)
        .slice(0, 5);

      return {
        revenue,
        cost: (variantsResult.data || []).reduce((acc, v) => acc + (v.stock * (v.cost || 0)), 0),
        ar: debtorsResult.data?.reduce((acc, c) => acc + (c.debt_balance || 0), 0) || 0,
        topSeller: { name: revenue > 0 ? 'Varios' : 'Sin ventas', sales: salesResult.data?.length || 0, revenue },
        productsCount: productsResult.data?.length || 0,
        criticalStock,
        agingDebtors: (debtorsResult.data || []).map(c => ({ name: c.name, debt: c.debt_balance, days: 0 })),
        deadStock: []
      };
    } catch (e) {
      console.error("Error fetching stats:", e);
      return { revenue: 0, cost: 0, ar: 0, topSeller: { name: '-', sales: 0, revenue: 0 }, productsCount: 0, criticalStock: [], agingDebtors: [], deadStock: [] };
    }
  },

  getSandboxStatus: async () => {
    return { isSandbox: false };
  },

  getProductsWithStock: async (category?: string) => {
    // Local-First: Read from Dexie
    let variants = await db.variants.toArray();
    
    if (category && category !== 'Todas') {
      // We need to join with products to filter by category
      const products = await db.products.where('category').equals(category).toArray();
      const productIds = new Set(products.map(p => p.id));
      variants = variants.filter(v => Boolean(v.product_id && productIds.has(v.product_id)));
    }

    // Map to the format expected by the POS, including price mapping
    const results = await Promise.all(variants.map(async (v) => {
      // DEFENSIVE GUARD: Dexie throws if ID is undefined/null
      if (!v.product_id || !isUUID(v.product_id)) {
        console.warn('⚠️ [api.getProductsWithStock] Variant missing valid product_id:', v);
        return null;
      }

      const product = await db.products.get(v.product_id);
      if (!product || product.status === 'deleted') return null;

      return mappers.mapVariantFromDB(v, product);
    }));

    return results.filter(r => r !== null) as any[];
  },

  searchProducts: async (term: string, category?: string) => {
    // Local-First: Read from Dexie
    const normalizedTerm = term.toLowerCase();
    
    // 1. Get products that match the name or barcode
    let products = await db.products
      .filter(p => 
        p.status !== 'deleted' && 
        (p.name.toLowerCase().includes(normalizedTerm) || (p.barcode?.includes(normalizedTerm) ?? false))
      )
      .toArray();

    if (category && category !== 'Todas') {
      products = products.filter(p => p.category === category);
    }

    const productIds = new Set(products.map(p => p.id));

    // 2. Get variants that match the SKU or belong to matched products
    const variants = await db.variants
      .filter(v => 
        Boolean(v.sku?.toLowerCase().includes(normalizedTerm) || 
        (v.product_id && productIds.has(v.product_id)))
      )
      .toArray();

    // 3. Map and merge
    const results = await Promise.all(variants.map(async (v) => {
      // DEFENSIVE GUARD: Dexie throws if ID is undefined/null
      if (!v.product_id || !isUUID(v.product_id)) {
        console.warn('⚠️ [api.searchProducts] Variant missing valid product_id:', v);
        return null;
      }

      const product = await db.products.get(v.product_id);
      if (!product || product.status === 'deleted') return null;
      if (category && category !== 'Todas' && product.category !== category) return null;

      return mappers.mapVariantFromDB(v, product);
    }));

    return results.filter(r => r !== null) as any[];
  },

  searchClients: async (term: string) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('store_id', storeId)
      .or(`name.ilike.%${term}%,dni_tax_id.ilike.%${term}%`)
      .limit(10);

    if (error) return [];
    return data || [];
  },

  getClients: async () => {
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('store_id', storeId)
      .order('name');

    if (error) return [];
    return data || [];
  },

  createClient: async (client: any) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    const payload = api._removeUndefined({
      ...client,
      store_id: storeId
    });

    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    window.dispatchEvent(new CustomEvent('refresh-clients'));
    return data;
  },

  voidSale: async (saleId: string, reason: string, userId: string) => {
    const storeId = await getCurrentStoreId();
    const { error } = await supabase.rpc('anular_venta', {
      p_sale_id: saleId,
      p_store_id: storeId,
      p_user_id: userId,
      p_reason: reason
    });
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('refresh-sales'));
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return true;
  },

  createProduct: async (productData: any) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    const { variants, ...fields } = productData;
    const payload = mappers.mapProductToDB({ ...fields, storeId, status: fields.status || 'active' });

    const { data: newProduct, error: pError } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();

    if (pError) throw pError;
    const product = newProduct;

    if (variants && variants.length > 0) {
      const cleanVariants = variants.map((v: any) => {
        const dbVariant = mappers.mapVariantToDB({ ...v, storeId });
        
        // Ensure id is GONE (PostgreSQL will generate UUID)
        // Ensure product_id is correctly set
        return {
          ...dbVariant,
          product_id: product.id,
          stock: 0 // No direct stock insertion as per rule
        };
      });
      
      const { error: vError } = await supabase
        .from('variants')
        .insert(cleanVariants);

      if (vError) throw vError;

      // 3. Volver a consultar las variantes ya guardadas (GROUND TRUTH)
      const { data: persistedVariants, error: fetchError } = await supabase
        .from('variants')
        .select('*')
        .eq('product_id', product.id)
        .eq('store_id', storeId);

      if (fetchError) {
        console.error("Error re-fetching variants for history:", fetchError);
      } else if (persistedVariants && persistedVariants.length > 0) {
        // 4. Registrar stock inicial vía RPC adjust_stock (SOLO esta función toca stock)
        for (const variant of persistedVariants) {
          const originalVariantData = variants.find((v: any) => v.sku === variant.sku);
          const initialStock = Number(originalVariantData?.stock || 0);
          
          if (initialStock > 0) {
            try {
              // Nueva firma: p_variant_id (uuid), p_quantity (int), p_reason (text), p_user_id (uuid)
              await supabase.rpc('adjust_stock', {
                p_variant_id: variant.id,
                p_quantity: initialStock,
                p_reason: 'Carga inicial (Alta de producto)',
                p_user_id: storeId
              });
            } catch (err) {
              console.error(`Error adjusting initial stock for variant ${variant.sku}:`, err);
            }
          }
        }
      }
    }
    // Mirror to local Dexie
    try {
      const { data: freshProd } = await supabase
        .from('products')
        .select(`*, variants(*)`)
        .eq('id', product.id)
        .single();
        
      if (freshProd) {
        const { variants: freshVariants, ...prodFields } = freshProd;
        await LocalRepository.upsertProducts([prodFields]);
        if (freshVariants) await LocalRepository.upsertVariants(freshVariants);
      }
    } catch (e) {
      console.warn("Mirror error after creation:", e);
    }
 
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    window.dispatchEvent(new CustomEvent('refresh-attributes'));
    return product;
  },

  updateProduct: async (id: string, productData: any) => {
    // Delegar al servicio unificado para asegurar que se ejecuten todas las sincronizaciones y logs
    return api.unifiedProductUpdate(id, {
      ...productData,
      updateReason: 'EDITOR COMPLETO'
    });
  },

  restoreProduct: async (id: UUID) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    // 1. Obtener variantes del producto para registrarlas antes de borrar
    const { error: vError } = await supabase
      .from('variants')
      .select('*')
      .eq('product_id', id)
      .eq('store_id', storeId);

    if (vError) throw vError;

    // 2. Restaurar producto
    const { error: dpError } = await supabase
      .from('products')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('store_id', storeId);

    if (dpError) throw dpError;

    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return true;
  },

  deleteProduct: async (id: UUID) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    // 1. Obtener datos del producto y sus variantes
    const { data: productData, error: pError } = await supabase
      .from('products')
      .select('name')
      .eq('id', id)
      .single();
      
    if (pError) console.warn("No se pudo obtener el nombre del producto para el log", pError);
    const productName = productData?.name || 'Producto Eliminado';

    const { data: variants, error: vError } = await supabase
      .from('variants')
      .select('*')
      .eq('product_id', id)
      .eq('store_id', storeId);

    if (vError) throw vError;

    // 2. Registrar movimientos de baja para cada variante
    for (const variant of variants || []) {
      try {
        await supabase.rpc('adjust_stock', {
          p_variant_id: variant.id,
          p_quantity: variant.stock || 0,
          p_type: 'EGRESO',
          p_reason: `Baja (Eliminado): ${productName}`,
          p_description: `Variante eliminada: ${variant.size || 'Único'} - ${variant.color || 'Único'}`,
          p_store_id: storeId,
          p_user_id: storeId
        });
      } catch (err) {
        console.error("Error logging deletion movement:", err);
      }
    }

    // 3. Eliminar variantes (Primero las variantes por integridad referencial)
    const { error: dvError } = await supabase
      .from('variants')
      .delete()
      .eq('product_id', id)
      .eq('store_id', storeId);

    if (dvError) throw dvError;

    // 4. Eliminar producto
    const { error: dpError } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);

    if (dpError) throw dpError;

    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return true;
  },

  // BRIDGE: Recibe el payload del POS y lo guarda localmente (Variant-Only Model)
  processSale: async (payload: { saleData: any, items: any[] }) => {
    const storeId = await getCurrentStoreId();
    const { saleData: rawSale, items: rawItems } = payload;

    // 1. Final Normalization for Local Repository
    const saleData = {
      id: rawSale.id,
      user_id: rawSale.user_id,
      store_id: storeId,
      client_id: rawSale.client_id || null,
      total: Number(rawSale.total || 0),
      payment_method: rawSale.payment_method || 'Efectivo',
      cash_amount: Number(rawSale.cash_amount || 0),
      credit_amount: Number(rawSale.credit_amount || 0),
      store_credit_amount: Number(rawSale.store_credit_amount || 0),
      vendedor: rawSale.vendedor,
      payments: rawSale.payments // Pass through for sync queue
    };

    const items = (rawItems || []).map((item: any) => {
      const variant_id = item.variant_id;
      const priceAtSale = Number(item.price_at_sale || 0);

      if (!variant_id) throw new Error("Item en venta no tiene variant_id");
      if (priceAtSale <= 0) throw new Error(`Precio inválido para variante ${variant_id}`);

      return {
        variant_id,
        quantity: Number(item.quantity || 0),
        price_at_sale: priceAtSale
      };
    });

    // 1.5 Final Gate: Strict validation before touch DB
    validateSyncPayload({ items, saleData: { total: saleData.total } });

    // 2. Guardar en Dexie de forma atómica
    const saleId = await LocalRepository.createSale(saleData, items);
    
    window.dispatchEvent(new CustomEvent('refresh-sales'));
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return { id: saleId, success: true };
  },

  processSaleCloud: async (params: any) => {
    console.log("RPC FUNCTION: procesar_venta");
    console.log("RPC PAYLOAD:", params);
    
    const { data, error } = await supabase.rpc('procesar_venta', params);
    
    if (error) {
      console.error("========== SUPABASE RPC ERROR ==========");
      console.error("RPC NAME:", 'procesar_venta');
      console.error("RPC PAYLOAD:", params);
      console.error("FULL ERROR:", error);
      console.error("MESSAGE:", error.message);
      console.error("DETAILS:", error.details);
      console.error("HINT:", error.hint);
      console.error("CODE:", error.code);

      throw {
        message: error.message || 'Remote sync failed',
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
        raw: error
      };
    }
    return data;
  },

  processSaleLocal: async (saleData: any) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); 
    
    // Map p_ fields to local server format (camelCase)
    const mappedData = {
      clientId: saleData.p_client_id,
      userId: saleData.p_user_id,
      cart: (saleData.p_cart || []).map((item: any) => ({
        id: item.variant_id,
        quantity: item.quantity,
        pvp: item.price
      })),
      total: saleData.p_total,
      paymentMethod: 'Venta POS',
      payments: {
        cash: (saleData.p_payments || []).filter((p: any) => p.type === 'cash').reduce((acc: number, p: any) => acc + p.finalAmount, 0) || 0,
        credit: (saleData.p_payments || []).filter((p: any) => p.type === 'credit' || p.type === 'qr' || p.type === 'debit').reduce((acc: number, p: any) => acc + p.finalAmount, 0) || 0,
        storeCredit: (saleData.p_payments || []).filter((p: any) => p.type === 'storeCredit').reduce((acc: number, p: any) => acc + p.finalAmount, 0) || 0
      }
    };

    try {
      const response = await fetch('http://localhost:5000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Fallo en servidor local');
      }
      return await response.json();
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') throw new Error('Servidor local no responde (timeout)');
      console.error("❌ [Local Sync] Error fatal:", e);
      throw e;
    }
  },

  getUsers: async () => {
    try {
      const storeId = await getCurrentStoreId();
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .eq('store_id', storeId)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error("Error fetching operators:", e);
      return [];
    }
  },

  createOperator: async (operator: { name: string; role: string; email?: string }) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    const { data, error } = await supabase
      .from('operators')
      .insert({ ...operator, store_id: storeId })
      .select()
      .single();

    if (error) throw error;
    window.dispatchEvent(new CustomEvent('refresh-operators'));
    return data;
  },

  deleteOperator: async (id: UUID) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    const { error } = await supabase
      .from('operators')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId);

    if (error) throw error;
    window.dispatchEvent(new CustomEvent('refresh-operators'));
    return true;
  },

  updateOperator: async (id: UUID, data: any) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    const { data: updated, error } = await supabase
      .from('operators')
      .update(data)
      .eq('id', id)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) throw error;
    window.dispatchEvent(new CustomEvent('refresh-operators'));
    return updated;
  },

  getSales: async (limit = 200) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, total, payment_method, store_id, user_id, created_at
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },

  getSalesForPeriod: async (from: string, to: string) => {
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, total, payment_method, store_id, user_id, created_at
      `)
      .eq('store_id', storeId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  },

  getSaleItems: async (saleId: UUID) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('sale_items')
      .select(`
        id, quantity, unit_price, subtotal,
        variants (sku, size, color, product:products(name))
      `)
      .eq('sale_id', saleId)
      .eq('store_id', storeId);

    if (error) return [];
    return data || [];
  },

  mirrorCloudToLocal: async () => {
    const storeId = await getCurrentStoreId();
    if (!storeId) return;

    console.log("🛠️ Initializing Local Mirror...");
    
    try {
      // 1. Mirror Products
      const { data: products } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('store_id', storeId);
      
      if (products) {
        await LocalRepository.upsertProducts(products);
        console.log(`✅ ${products.length} Products mirrored`);
      }

      // 2. Mirror Variants
      const { data: variants } = await supabase
        .from('variants')
        .select(VARIANT_SELECT)
        .eq('store_id', storeId);
      
      if (variants) {
        await LocalRepository.upsertVariants(variants);
        console.log(`✅ ${variants.length} Variants mirrored`);
      }

      // 3. Mirror Operators
      const { data: operators } = await supabase
        .from('operators')
        .select('*')
        .eq('store_id', storeId);
      
      if (operators) {
        await db.operators.bulkPut(operators.map(o => ({
          ...o,
          sync_status: 'synced',
          updated_at: Date.now()
        })));
        console.log(`✅ ${operators.length} Operators mirrored`);
      }
      
      console.log("🚀 Local Mirror Complete");
    } catch (error) {
      console.error("❌ Mirroring Error:", error);
    }
  },

  getProducts: async () => {
    // Local-First: Read from Dexie
    const localProducts = await LocalRepository.getAllProducts();
    if (localProducts.length > 0) return localProducts;

    // Fallback to cloud if local is empty (initial load)
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('name');

    if (error) return [];
    return data || [];
  },

  getVariants: async (productId?: UUID) => {
    // Local-First: Read from Dexie
    if (productId) {
      return await db.variants
        .where('product_id').equals(String(productId))
        .and(v => !v.deleted)
        .toArray();
    }
    return await db.variants.toCollection().filter(v => !v.deleted).toArray();
  },

  getAllProducts: async () => {
    const storeId = await getCurrentStoreId();
    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('store_id', storeId)
      .or('status.eq.active,status.is.null');

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(p => ({
      ...p,
      ...api._mapPrices(p)
    }));
  },

  getInventoryItems: async () => {
    // 1. Local-First: Read from Dexie (Instant & Offline-First)
    const localItems = await LocalRepository.getInventoryItemsWithProducts();
    if (localItems.length > 0) return localItems;

    // 2. Fallback to Cloud (Only on initial load or if local is wiped)
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('variants')
      .select(`*, products(${PRODUCT_SELECT})`)
      .eq('store_id', storeId);

    if (error) return [];
    
    const cloudItems = (data || [])
      .filter((v: any) => v.products && v.products.status !== 'deleted')
      .map((v: any) => mappers.mapVariantFromDB(v, v.products));
    
    // Background sync to LocalRepository if we got cloud items but local was empty
    if (cloudItems.length > 0) {
      LocalRepository.upsertVariants(data || []).catch(console.error);
    }

    return cloudItems;
  },

  getDeletedInventoryItems: async () => {
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('variants')
      .select(`
        id, product_id, sku, color, size, stock, stock_minimo, cost, margin, pvp, is_custom,
        products (name, category, brand, season, barcode, provider_info, base_price, cost, base_margin)
      `)
      .eq('store_id', storeId)
      .eq('products.status', 'deleted')
      .order('id', { ascending: true });

    if (error) throw error;

    return (data || []).map((v: any) => {
      const prices = api._mapPrices(v);
      return {
        ...v,
        name: v.products?.name,
        ...prices,
        category: v.products?.category,
        brand: v.products?.brand,
        season: v.products?.season,
        provider_info: v.products?.provider_info
      };
    });
  },

  updateProductBase: async (id: UUID, fields: { cost?: number; base_margin?: number; base_price?: number; provider_info?: string }) => {
    const storeId = await getCurrentStoreId();
    const { error } = await supabase
      .from('products')
      .update(fields)
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) throw error;
    
    // Mirror to local Dexie
    try {
      const { data: freshProd } = await supabase
        .from('products')
        .select(`*, variants(*)`)
        .eq('id', id)
        .single();
        
      if (freshProd) {
        const { variants: freshVariants, ...prodFields } = freshProd;
        await LocalRepository.upsertProducts([prodFields]);
        if (freshVariants) await LocalRepository.upsertVariants(freshVariants);
      }
    } catch (e) {
      console.warn("Mirror error after updateProductBase:", e);
    }

    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return true;
  },

  massPriceAdjust: async (percentage: number) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase.rpc('mass_price_adjust', {
      p_percentage: percentage,
      p_store_id: storeId
    });
    if (error) throw error;
    await api.mirrorCloudToLocal();
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return data;
  },

  massMarginAdjust: async (newMargin: number) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase.rpc('mass_margin_adjust', {
      p_margin: newMargin,
      p_store_id: storeId
    });
    if (error) throw error;
    await api.mirrorCloudToLocal();
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return data;
  },

  getProductVariants: async (id: UUID) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('variants')
      .select(VARIANT_SELECT)
      .eq('product_id', id)
      .eq('store_id', storeId);

    if (error) throw error;
    return data;
  },

  updateVariant: async (id: UUID, data: any) => {
    const storeId = await getCurrentStoreId();
    
    const dbVariant = mappers.mapVariantToDB({ ...data, storeId });
    
    // REMOVE product_id and id from the update payload
    // postgres_changes callbacks after subscribe() will fail if we send product_id in some RLS setups
    const { id: _, product_id: __, ...updatePayload } = dbVariant;

    const { error } = await supabase
      .from('variants')
      .update(updatePayload)
      .eq('id', id)
      .eq('store_id', storeId);
      
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return true;
  },


  updateStock: async (id: UUID, quantity: number, type: string, reason: string, userId: UUID) => {
    if (!isUUID(id)) throw new Error("Invalid Variant UUID");
    const storeId = await getCurrentStoreId();
    if (!storeId) throw new Error("No autenticado");

    // Calcular impacto (positivo o negativo)
    const impact = type === 'INGRESO' ? Math.abs(quantity) : -Math.abs(quantity);

    // Actualizar stock y registrar movimiento vía RPC (Único punto de entrada)
    // Firma: p_variant_id (uuid), p_quantity (int), p_reason (text), p_user_id (uuid)
    const { error: uError } = await supabase.rpc('adjust_stock', {
      p_variant_id: id,
      p_quantity: impact,
      p_reason: reason || 'Ajuste manual',
      p_user_id: userId || storeId
    });

    if (uError) throw uError;
 
    window.dispatchEvent(new CustomEvent('refresh-stock'));
    return true;
  },

  getProductByBarcode: async (barcode: string) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('products')
      .select(`${PRODUCT_SELECT}, status, variants(${VARIANT_SELECT})`)
      .eq('barcode', barcode)
      .eq('store_id', storeId)
      .neq('status', 'deleted')
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0];
  },

  getProductById: async (id: string) => {
    if (!id) return null;
    const storeId = await getCurrentStoreId();

    try {
      if (!id || !isUUID(id)) {
        console.warn('⚠️ [api.getProductById] Invalid product ID:', id);
        return null;
      }
      const { data, error } = await supabase
        .from('products')
        .select(`${PRODUCT_SELECT}, variants(${VARIANT_SELECT})`)
        .eq('id', id)
        .eq('store_id', storeId)
        .single();

      if (error || !data) return null;

      return { ...data, ...api._mapPrices(data), variants: data.variants || [] };
    } catch (e) {
      return null;
    }
  },

  getVariantBySku: async (sku: string) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('variants')
      .select(`${VARIANT_SELECT}, products(${PRODUCT_SELECT})`)
      .eq('sku', sku)
      .eq('store_id', storeId)
      .maybeSingle();
    if (error) return null;
    return data;
  },


  getInventoryHistory: async (limit = 50, offset = 0) => {
    const storeId = await getCurrentStoreId();

    const { data, error } = await supabase.rpc('get_inventory_history', {
      p_store_id: storeId,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      console.error("Error calling get_inventory_history:", error);
      return [];
    }
    
    // El RPC ya devuelve los datos unidos con productos y variantes (product, size, color, etc)
    return (data || []).map((m: any) => ({
      ...m,
      type: m.movement,      // Antes movement_type
      
      reason: m.action,      // Antes action_type
      change_amount: m.quantity,
      product_name: m.product, // Antes product_name
      operator: m.operator_name || 'Sistema'
    }));
  },


  annulMovementsBatch: async (
    sessionMovements: Array<{ variant_id: string; quantity?: number }>,
    _operatorName: string,
    userId: string,
    originalEventId: string | null
  ) => {
    const valid = sessionMovements.filter((m) => m.variant_id != null);
    
    for (const m of valid) {
      const amount = Math.abs(m.quantity || 0);
      const reversalType = (m.quantity || 0) > 0 ? 'EGRESO' : 'INGRESO';

      await api.updateStock(
        m.variant_id,
        amount,
        reversalType,
        `ANULACION: Reversa de operación ${originalEventId ?? 'manual'}`,
        userId
      );
    }
    return true;
  },

  getSuppliers: async () => {
    const storeId = await getCurrentStoreId();
    if (!storeId) return [];

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('store_id', storeId)
      .order('name');

    if (error) return [];
    return data || [];
  },

  createSupplier: async (supplier: any) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ ...supplier, store_id: storeId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateSupplier: async (id: string, supplier: any) => {
    const storeId = await getCurrentStoreId();
    const { data, error } = await supabase
      .from('suppliers')
      .update(supplier)
      .eq('id', id)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // SKU GENERATION HELPERS
  normalizar: (texto: string) => {
    if (!texto) return '';
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Elimina tildes
      .replace(/[^a-zA-Z0-9]/g, "")   // Elimina caracteres no alfanuméricos
      .toUpperCase()
      .trim();
  },

  generarSufijo: () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  },

  generarSkuSeguro: async (categoria: string, color: string, talle: string) => {
    const rubro = api.normalizar(categoria).substring(0, 3);
    const col = api.normalizar(color).substring(0, 3);
    const tal = api.normalizar(talle);
    const suffix = api.generarSufijo();
    return `${rubro}-${col}-${tal}-${suffix}`;
  },

  getInventoryItemsREST: async () => {
    return api.getInventoryItems();
  },

  _mapUUID: (obj: any, type: 'variant' | 'product' | 'sale' | 'movement') => {
    if (!obj) return obj;
    const mapped = { ...obj };
    if (type === 'variant') {
      mapped.uuid = obj.id;
      mapped.product_uuid = obj.product_id;
    } else if (type === 'product') {
      mapped.uuid = obj.id;
    } else if (type === 'sale') {
      mapped.uuid = obj.id;
      mapped.client_uuid = obj.client_id;
      mapped.user_uuid = obj.user_id;
    } else if (type === 'movement') {
      mapped.uuid = obj.id;
      mapped.variant_uuid = obj.variant_id;
    }
    return mapped;
  },

  getCatalogAttributes: async () => {
    try {
      const saved = localStorage.getItem('arcadia_catalog_attributes');
      return saved ? JSON.parse(saved) : { categories: [], brands: [], colors: [], seasons: [] };
    } catch (e) {
      return { categories: [], brands: [], colors: [], seasons: [] };
    }
  },

  addCatalogAttribute: async (type: string, value: string) => {
    try {
      const saved = localStorage.getItem('arcadia_catalog_attributes');
      let attributes = saved ? JSON.parse(saved) : {};
      
      if (!attributes[type]) attributes[type] = [];
      if (!attributes[type].includes(value)) {
        attributes[type].push(value);
      }
      
      localStorage.setItem('arcadia_catalog_attributes', JSON.stringify(attributes));
      window.dispatchEvent(new CustomEvent('refresh-attributes'));
      return true;
    } catch (e) {
      console.error("Error adding catalog attribute:", e);
      throw e;
    }
  }
};
