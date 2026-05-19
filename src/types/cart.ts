import { UUID } from './uuid';

export interface CartItem {
  variant_id: UUID;
  sku: string;
  name: string;
  price_at_sale: number;
  quantity: number;
  size: string;
  color: string;
  image?: string;
  category: string;
  stock: number;
  prices: {
    cash: number;
    debit: number;
    credit: number;
  };
  
  // Legacy cleanup: product_id is removed from the transaction model
}

export interface PendingOrder {
  id: string;
  cart: CartItem[];
  customer: any;
  timestamp: number;
  discount: number;
  total: number;
}
