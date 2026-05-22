export { isUUID } from '../types/uuid';

export function validateCartItem(item: any): any {
  if (!item || typeof item !== 'object') {
    throw new Error('Cart item must be an object');
  }

  const variant_id = item.variant_id;
  if (!variant_id || typeof variant_id !== 'string') {
    throw new Error('Item must have a valid variant_id');
  }

  const sku = item.sku || '';
  const name = item.name || '';

  const price_at_sale = Number(item.price_at_sale);
  if (isNaN(price_at_sale) || price_at_sale < 0) {
    throw new Error(`Invalid price_at_sale for variant ${variant_id}`);
  }

  const quantity = Number(item.quantity);
  const qty = isNaN(quantity) || quantity < 0 ? 0 : quantity;

  const size = typeof item.size === 'string' ? item.size : '';
  const color = typeof item.color === 'string' ? item.color : '';
  const category = typeof item.category === 'string' ? item.category : '';

  const stock = Number(item.stock);
  const stk = isNaN(stock) ? 0 : stock;

  const rawPrices = item.prices || {};
  const prices = {
    cash: Number(rawPrices.cash) || 0,
    debit: Number(rawPrices.debit) || 0,
    credit: Number(rawPrices.credit) || 0,
  };

  const cleaned: any = {
    variant_id,
    sku,
    name,
    price_at_sale,
    quantity: qty,
    size,
    color,
    category,
    stock: stk,
    prices,
  };

  if (typeof item.image === 'string') {
    cleaned.image = item.image;
  }

  return cleaned;
}

export function validateSyncPayload(payload: any): void {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Sync payload must be an object');
  }

  const { items, saleData } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Sync payload must contain a non-empty items array');
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item || typeof item !== 'object') {
      throw new Error(`Item at index ${i} is not a valid object`);
    }

    const vid = item.variant_id || item.variantId;
    if (!vid || typeof vid !== 'string') {
      throw new Error(`Item at index ${i} is missing a valid variant_id UUID`);
    }

    const price = Number(item.price_at_sale);
    if (isNaN(price) || price <= 0) {
      throw new Error(`Item at index ${i} has invalid Price (must be > 0): ${price}`);
    }

    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error(`Item at index ${i} has invalid quantity (must be > 0): ${qty}`);
    }
  }

  if (!saleData || typeof saleData !== 'object') {
    throw new Error('Sync payload must contain saleData');
  }

  const total = Number(saleData.total);
  if (isNaN(total) || total <= 0) {
    throw new Error('Sale total must be a positive number');
  }
}

export function validateSaleItemStrict(item: any): void {
  if (!item || typeof item !== 'object') {
    throw new Error('Sale item must be an object');
  }

  const variantId = item.variant_id;
  if (!variantId || typeof variantId !== 'string') {
    throw new Error('Sale item missing variant_id');
  }

  const price = Number(item.price_at_sale);
  if (isNaN(price) || price <= 0) {
    throw new Error(`Sale item ${variantId} has invalid price_at_sale: ${price}`);
  }

  const qty = Number(item.quantity);
  if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
    throw new Error(`Sale item ${variantId} has invalid quantity: ${qty}`);
  }
}

export function normalizeAttributeValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function sanitizeNumericSize(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  const num = parseFloat(trimmed);
  return num <= 0 ? trimmed : String(num);
}
