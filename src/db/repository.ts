import { db } from './database';
import { DeviceService } from '../services/deviceService';


export const LocalRepository = {
  // --- Products ---
  upsertProducts: async (products: any[]) => {
    const now = Date.now();
    const deviceId = DeviceService.getDeviceId();
    
    return await db.transaction('rw', db.products, async () => {
      for (const p of products) {
        // Normalize keys and validate
        const id = p.id || p.uuid;
        if (!id) {
          console.error("🚨 [LocalRepository] Cannot upsert product: Missing ID", p);
          continue;
        }

        await db.products.put({
          id: id,
          name: p.name,
          category: p.category,
          brand: p.brand,
          season: p.season,
          barcode: p.barcode,
          iva_rate: p.iva_rate || p.ivaRate || 21,
          base_price: p.base_price || p.basePrice,
          cost: p.cost,
          base_margin: p.base_margin || p.baseMargin || 60,
          provider_info: typeof p.provider_info === 'object' ? JSON.stringify(p.provider_info) : (p.provider_info || p.providerInfo),
          status: p.status || 'active',
          created_at: p.created_at || new Date().toISOString(),
          store_id: p.store_id || p.storeId,
          user_id: p.user_id || p.userId,
          updated_at: now,
          sync_status: 'synced',
          synced_at: now,
          device_id: deviceId
        });
      }
    });
  },

  getAllProducts: async () => {
    return await db.products.toCollection().filter(p => !p.deleted).toArray();
  },

  // --- Variants ---
  upsertVariants: async (variants: any[]) => {
    const now = Date.now();
    const deviceId = DeviceService.getDeviceId();

    return await db.transaction('rw', db.variants, async () => {
      for (const v of variants) {
        // Normalize keys and validate
        const id = v.id || v.uuid || v.variant_id || v.variant_uuid;
        const product_id = v.product_id || v.product_uuid || v.productId;

        if (!id) {
          console.error("🚨 [LocalRepository] Cannot upsert variant: Missing ID", { id, v });
          continue;
        }

        await db.variants.put({
          id: id,
          product_id: product_id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: Number(v.stock) || 0,
          stock_minimo: Number(v.stock_minimo || v.stockMinimo) || 0,
          cost: Number(v.cost) || 0,
          margin: Number(v.margin) || 0,
          pvp: Number(v.pvp || v.priceCash) || 0,
          credit_price: Number(v.credit_price || v.priceCredit) || 0,
          debit_price: Number(v.debit_price || v.priceDebit) || 0,
          is_custom: !!(v.is_custom || v.isCustom),
          store_id: v.store_id || v.storeId,
          created_at: v.created_at || new Date().toISOString(),
          updated_at: now,
          sync_status: 'synced',
          synced_at: now,
          device_id: deviceId
        });
      }
    });
  },

  // --- Sales ---
  createSale: async (saleData: any, items: any[]) => {
    const now = Date.now();
    const deviceId = DeviceService.getDeviceId();
    const saleId = saleData.id || saleData.uuid || crypto.randomUUID();

    return await db.transaction('rw', [db.sales, db.sale_items, db.variants, db.movements, db.sync_queue], async () => {
      // 1. Sale - Normalize keys
      const clientId = saleData.client_id || saleData.clientId || saleData.client_uuid;
      const userId = saleData.user_id || saleData.userId || saleData.user_uuid;

      await db.sales.add({
        ...saleData,
        id: saleId,
        client_id: clientId,
        user_id: userId,
        updated_at: now,
        sync_status: 'pending',
        device_id: deviceId,
        created_at: new Date().toISOString()
      });

      // 2. Items & Stock Updates
      for (const item of items) {
        const variantId = item.variant_id;
        
        if (!variantId) {
          throw new Error(`🚨 [LocalRepository] Item incompleto: v=${variantId}`);
        }

        await db.sale_items.add({
          id: crypto.randomUUID(),
          sale_id: saleId,
          variant_id: variantId,
          quantity: item.quantity,
          price_at_sale: item.price_at_sale,
          updated_at: now,
          sync_status: 'pending',
          created_at: new Date().toISOString()
        });

        // Update local stock
        await db.variants.where('id').equals(variantId).modify(v => {
          v.stock -= item.quantity;
          v.updated_at = now;
          v.sync_status = 'pending';
        });

        // Record movement
        await db.movements.add({
          id: crypto.randomUUID(),
          variant_id: variantId,
          quantity: item.quantity,
          type: 'EGRESO',
          reason: 'Venta POS',
          description: `Venta #${saleId}`,
          created_at: new Date().toISOString(),
          updated_at: now,
          sync_status: 'pending',
          device_id: deviceId
        });
      }

      // 3. Queue Sync Task - Ensure payload is sanitized and uses standard keys
      const sanitizedItems = items.map(item => ({
        variant_id: item.variant_id || item.variant_uuid || item.id,
        quantity: item.quantity,
        price_at_sale: item.price_at_sale || item.priceAtSale || item.price
      }));

      await db.sync_queue.add({
        id: crypto.randomUUID(),
        operation_type: 'RPC',
        operation_order: now,
        type: 'CREATE_SALE',
        payload: { 
          saleData: { 
            ...saleData, 
            id: saleId,
            client_id: clientId,
            user_id: userId
          }, 
          items: sanitizedItems,
          payments: saleData.payments || [] 
        },
        status: 'pending',
        retries: 0,
        created_at: now
      });

      return saleId;
    });
  },

  // --- Movements ---
  createMovement: async (movement: any) => {
    const now = Date.now();
    const deviceId = DeviceService.getDeviceId();
    const id = crypto.randomUUID();
    const variantId = movement.variant_id || movement.variant_uuid || movement.id;

    if (!variantId) {
      throw new Error("🚨 [LocalRepository] No se puede crear movimiento: Missing variant_id");
    }

    return await db.transaction('rw', [db.movements, db.variants, db.sync_queue], async () => {
      await db.movements.add({
        ...movement,
        id,
        variant_id: variantId,
        updated_at: now,
        sync_status: 'pending',
        device_id: deviceId
      });

      // Update stock
      await db.variants.where('id').equals(variantId).modify(v => {
        const delta = movement.type === 'INGRESO' ? movement.quantity : -movement.quantity;
        v.stock += delta;
        v.updated_at = now;
        v.sync_status = 'pending';
      });

      // Queue Sync
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        operation_type: 'RPC',
        operation_order: now,
        type: 'UPDATE_STOCK', 
        payload: { ...movement, id, variant_id: variantId },
        status: 'pending',
        retries: 0,
        created_at: now
      });

      return id;
    });
  },

  getPendingTasks: async () => {
    return await db.sync_queue
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('created_at');
  },

  // --- Joined Queries (Local-First) ---
  getInventoryItemsWithProducts: async () => {
    // Manual join in Dexie
    const [variants, products] = await Promise.all([
      db.variants.toArray(),
      db.products.toArray()
    ]);

    const productMap = new Map(products.map(p => [p.id, p]));

    return variants
      .filter(v => {
        if (!v.product_id) {
          console.warn('⚠️ [LocalRepository] Variant missing product_id in inventory join:', v);
          return false;
        }
        const product = productMap.get(v.product_id);
        return product && product.status !== 'deleted';
      })
      .map(v => {
        const product = productMap.get(v.product_id);
        if (!product) return null;

        // Map to standard frontend schema
        return {
          id: v.id,
          productId: v.product_id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          stock: v.stock,
          stockMinimo: v.stock_minimo,
          cost: v.cost,
          margin: v.margin,
          priceCash: v.pvp,
          priceDebit: v.debit_price || v.pvp,
          priceCredit: v.credit_price || v.pvp,
          name: product.name,
          category: product.category,
          brand: product.brand,
          season: product.season,
          providerInfo: product.provider_info,
          status: product.status
        };
      })
      .filter((v): v is any => v !== null);
  }
};
