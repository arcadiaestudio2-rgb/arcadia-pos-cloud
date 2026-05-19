import { UUID } from '../types/uuid';
import { LocalProduct } from '../db/database';
import { InventoryItem } from '../hooks/useInventory';

/**
 * Centralized mapping utility for Arcadia POS.
 * Decouples domain models (React/camelCase) from the Database/API schema (SQL/snake_case).
 */

export const mappers = {
  /**
   * Maps a raw SQL/Database product to the frontend domain model.
   */
  mapProductFromDB: (p: any): Partial<LocalProduct> => {
    if (!p) return {};
    return {
      id: p.id as UUID,
      name: p.name,
      category: p.category,
      brand: p.brand,
      barcode: p.barcode,
      status: p.status,
      iva_rate: p.iva_rate || 21,
      base_price: p.base_price,
      cost: p.cost,
      base_margin: p.base_margin,
      provider_info: p.provider_info,
      created_at: p.created_at,
      store_id: p.store_id
    };
  },

  /**
   * Maps a domain product to the Database schema (snake_case).
   */
  mapProductToDB: (p: any): any => {
    const mapped: any = {};
    if (p.id) mapped.id = p.id;
    if (p.name !== undefined) mapped.name = p.name;
    if (p.category !== undefined) mapped.category = p.category;
    if (p.brand !== undefined) mapped.brand = p.brand;
    if (p.season !== undefined) mapped.season = p.season;
    if (p.barcode !== undefined) mapped.barcode = p.barcode;
    if (p.ivaRate !== undefined) mapped.iva_rate = p.ivaRate;
    if (p.basePrice !== undefined) mapped.base_price = p.basePrice;
    if (p.cost !== undefined) mapped.cost = p.cost;
    if (p.baseMargin !== undefined) mapped.base_margin = p.baseMargin;
    if (p.providerInfo !== undefined) mapped.provider_info = p.providerInfo;
    if (p.status !== undefined) mapped.status = p.status;
    if (p.storeId !== undefined) mapped.store_id = p.storeId;
    if (p.userId !== undefined) mapped.user_id = p.userId;
    return mapped;
  },

  /**
   * Maps a raw SQL/Database variant to the domain model (InventoryItem).
   */
  mapVariantFromDB: (v: any, product?: any): InventoryItem => {
    const cost = Number(v.cost || product?.cost || 0);
    const margin = Number(v.margin || product?.base_margin || 0);
    
    // Use explicit DB columns or calculate based on margin
    // Fallback order: variant.pvp -> calculated from cost/margin -> product.base_price -> 0
    const cashPrice = Number(v.pvp || (cost > 0 ? (cost * (1 + margin / 100)) : (product?.base_price || 0)));
    const debitPrice = Number(v.debit_price || (cashPrice * 1.10));
    const creditPrice = Number(v.credit_price || (cashPrice * 1.20));
    
    return {
      id: v.id as UUID,
      productId: (v.product_id || product?.id) as UUID,
      name: product?.name || 'Producto',
      sku: v.sku,
      color: v.color,
      size: v.size,
      stock: v.stock || 0,
      stockMinimo: v.stock_minimo || 0,
      cost: cost,
      margin: margin,
      priceCash: cashPrice,
      priceDebit: debitPrice,
      priceCredit: creditPrice,
      category: product?.category || '',
      brand: product?.brand || '',
      season: product?.season || '',
      isCustom: v.is_custom,
      providerInfo: v.provider_info || product?.provider_info || ''
    };
  },

  /**
   * Maps a domain model back to the SQL/Database schema (snake_case).
   */
  mapVariantToDB: (item: any): any => {
    const mapped: any = {};
    
    // DEFENSIVE ID GUARD: Only keep existing UUIDs. 
    // New variants (falsy id or "new-*") MUST OMIT id so PostgreSQL can auto-generate it.
    if (item.id && !String(item.id).startsWith('new-')) {
      mapped.id = item.id;
    }

    if (item.sku !== undefined) mapped.sku = item.sku;
    if (item.size !== undefined) mapped.size = item.size;
    if (item.color !== undefined) mapped.color = item.color;
    if (item.stock !== undefined) mapped.stock = item.stock;
    if (item.stockMinimo !== undefined) mapped.stock_minimo = item.stockMinimo;
    if (item.cost !== undefined) mapped.cost = item.cost;
    if (item.margin !== undefined) mapped.margin = item.margin;
    if (item.priceCash !== undefined) mapped.pvp = item.priceCash;
    if (item.priceDebit !== undefined) mapped.debit_price = item.priceDebit;
    if (item.priceCredit !== undefined) mapped.credit_price = item.priceCredit;
    if (item.isCustom !== undefined) mapped.is_custom = item.isCustom;
    if (item.storeId !== undefined) mapped.store_id = item.storeId;
    if (item.userId !== undefined) mapped.user_id = item.userId;
    
    // ARCHITECTURE RULE: Never send product_id in variant mutation payloads.
    // PostgreSQL handles relations via internal logic or explicit separate logic if needed.
    return mapped;
  }
};
