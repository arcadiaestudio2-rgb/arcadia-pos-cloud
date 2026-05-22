import Dexie, { Table } from 'dexie';
import { UUID } from '../types/uuid';
// ID Generation: Switching to native crypto.randomUUID() for Supabase compatibility

// Interfaces based on the unified schema but extended for sync and local-first requirements
export interface SyncMetadata {
  updated_at: number;
  sync_status: 'pending' | 'synced' | 'error';
  synced_at?: number;
  deleted?: boolean;
  device_id?: string;
  sync_batch_id?: string;
  last_sync_error?: string;
}

export interface BaseEntity extends SyncMetadata {
  id: UUID;
  created_at: string;
  deleted_at?: string;
  store_id?: string;
  user_id?: string;
  device_id?: string;
}

export interface LocalProduct extends BaseEntity {
  name: string;
  category: string;
  brand?: string;
  season?: string;
  barcode?: string;
  iva_rate: number;
  base_price?: number;
  cost?: number;
  base_margin: number;
  provider_info?: string;
  status: string;
}

export interface LocalVariant extends BaseEntity {
  product_id: UUID;
  sku: string;
  size: string;
  color: string;
  stock: number;
  cost?: number;
  margin?: number;
  pvp?: number;
  credit_price?: number;
  debit_price?: number;
  stock_minimo: number;
  is_custom?: boolean;
}

export interface LocalSale extends BaseEntity {
  created_at: string;
  client_id?: UUID;
  total: number;
  discount: number;
  payment_method: string;
  cash_amount: number;
  credit_amount: number;
  store_credit_amount: number;
  vendedor?: string;
  payments?: any[];
  void_reason?: string;
  voided_at?: string;
}

export interface LocalSaleItem extends BaseEntity {
  sale_id: UUID;
  variant_id: UUID;
  quantity: number;
  price_at_sale: number;
}

export interface LocalMovement extends BaseEntity {
  variant_id: UUID;
  quantity: number;
  type: 'INGRESO' | 'EGRESO';
  reason: string;
  description: string;
}

export interface LocalOperator extends BaseEntity {
  name: string;
  role: string;
  email?: string;
}

export interface LocalClient extends BaseEntity {
  name: string;
  dni_tax_id: string;
  phone?: string;
  debt_balance: number;
  credit_limit: number;
}

export interface CreateSalePayload {
  saleData: LocalSale;
  items: LocalSaleItem[];
}

export interface SyncTask {
  id: string; // ULID or UUID
  transaction_id?: UUID;
  operation_type: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC';
  operation_order: number;
  type: 'CREATE_SALE' | 'UPDATE_STOCK' | 'CREATE_MOVEMENT' | 'UPDATE_PRODUCT' | 'UPDATE_CLIENT';
  payload: any;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  retries: number;
  created_at: number;
  synced_at?: number;
  failed_at?: number;
  next_retry_at?: number;
  last_error?: string;
}

export class ArcadiaDatabase extends Dexie {
  products!: Table<LocalProduct>;
  variants!: Table<LocalVariant>;
  sales!: Table<LocalSale>;
  sale_items!: Table<LocalSaleItem>;
  movements!: Table<LocalMovement>;
  operators!: Table<LocalOperator>;
  clients!: Table<LocalClient>;
  sync_queue!: Table<SyncTask>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('ArcadiaPOS-v2');
    this.version(3).stores({
      products: 'id, name, category, barcode, status, store_id, sync_status, deleted',
      variants: 'id, product_id, sku, store_id, sync_status, deleted',
      sales: 'id, created_at, user_id, client_id, store_id, sync_status',
      sale_items: 'id, sale_id, variant_id, sync_status',
      movements: 'id, variant_id, store_id, user_id, sync_status',
      operators: 'id, name, email, store_id, sync_status',
      clients: 'id, name, dni_tax_id, store_id, sync_status',
      sync_queue: 'id, type, status, created_at',
      settings: 'key'
    });
  }

  // Helper to generate UUIDs
  generateId() {
    return crypto.randomUUID();
  }

  // Atomic transaction for processing a sale
  async processSaleAtomic(saleData: any, items: any[], stockUpdates: any[]) {
    return await this.transaction('rw', 
      [this.sales, this.sale_items, this.variants, this.movements, this.sync_queue], 
      async () => {
        const saleId = saleData.id || this.generateId();
        const now = Date.now();

        // 1. Save Sale
        await this.sales.add({
          ...saleData,
          id: saleId,
          updated_at: now,
          sync_status: 'pending'
        });

        // 2. Save Sale Items
        for (const item of items) {
          await this.sale_items.add({
            ...item,
            id: this.generateId(),
            sale_id: saleId,
            updated_at: now,
            sync_status: 'pending'
          });
        }

        // 3. Update Stock & Record Movements
        for (const update of stockUpdates) {
          // Update variant stock
          await this.variants.where('id').equals(update.variant_id).modify(v => {
            v.stock += update.quantity; // quantity is usually negative for sales
            v.updated_at = now;
            v.sync_status = 'pending';
          });

          // Record movement
          await this.movements.add({
            id: this.generateId(),
            variant_id: update.variant_id,
            quantity: Math.abs(update.quantity),
            type: update.quantity < 0 ? 'EGRESO' : 'INGRESO',
            reason: update.reason || 'Venta POS',
            description: update.description || `Venta #${saleId}`,
            created_at: new Date().toISOString(),
            updated_at: now,
            sync_status: 'pending'
          });
        }

        // 4. Queue Cloud Sync
        await this.sync_queue.add({
          id: this.generateId(),
          transaction_id: saleId,
          operation_type: 'INSERT',
          operation_order: 1,
          type: 'CREATE_SALE',
          payload: { saleData, items, stockUpdates },
          status: 'pending',
          retries: 0,
          created_at: now
        });

        return saleId;
      }
    );
  }
}

// --- SINGLETON PATTERN (STRICT) ---
let dbInstance: ArcadiaDatabase | null = null;

const getDB = () => {
  if (dbInstance) return dbInstance;
  console.log("💾 [DB] Initializing Singleton Connection...");
  dbInstance = new ArcadiaDatabase();
  
  // Handle database blocked (usually other tabs or double init)
  dbInstance.on('blocked', () => {
    console.warn("⚠️ [DB] Connection BLOCKED. Attempting to resolve...");
  });

  return dbInstance;
};

export const db = getDB();
