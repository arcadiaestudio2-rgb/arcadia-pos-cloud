export const isUUID = (id: any): id is string => {
  if (typeof id !== 'string') return false;
  if (id === 'undefined' || id === 'null' || !id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Type guard for variants with valid product_id
 */
export const hasProductId = (v: any): v is { product_id: string } => {
  return Boolean(v && v.product_id && isUUID(v.product_id));
};

/**
 * ARCADIA TRANSACTION VALIDATOR (Variant-Only Model)
 * Enforces strict POS rules for sales:
 * - Mandatory variant_id (UUID)
 * - Positive finite quantity
 * - Positive finite price
 */
export function validateCartItem(item: any) {
  if (!item) throw new Error("Item is missing");

  // EXTRACT CRITICAL TRANSACTABLES
  const variant_id = item.variant_id || item.variantId || item.id;
  const quantity = Number(item.quantity);
  const price_at_sale = Number(item.price_at_sale ?? 0);

  // STRICT VARIANT GUARD
  if (!variant_id || !isUUID(variant_id)) {
    console.error("❌ [MISSING_VARIANT_ID] Blocking item:", item);
    throw new Error("Missing variant_id: El producto no tiene un identificador de variante válido.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid quantity: ${quantity}`);
  if (!Number.isFinite(price_at_sale) || price_at_sale <= 0) throw new Error(`Invalid price: ${price_at_sale}`);

  // RETURN UNIFIED OBJECT: Preserve metadata for UI, strictly normalize contract for Sync/RPC
  return {
    ...item,
    variant_id,
    quantity,
    price_at_sale,
    prices: item.prices || { cash: price_at_sale, debit: price_at_sale, credit: price_at_sale }
  };
}

// Minimal Sync Payload Validator (Variant-Only)
export const validateSyncPayload = (payload: any) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) throw new Error("La venta no tiene items");
  
  items.forEach(validateCartItem);
  
  if (!Number.isFinite(payload.saleData?.total) || payload.saleData.total < 0) {
    throw new Error("Total de venta inválido");
  }
};

// Aliases for backward compatibility
export const validateSaleItem = validateCartItem;
export const validateSaleItemStrict = validateCartItem;
