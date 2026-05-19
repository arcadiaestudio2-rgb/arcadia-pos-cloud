import { db, SyncTask, CreateSalePayload } from '../db/database';
import { api } from './api';
import { validateSyncPayload, validateSaleItemStrict } from '../utils/validation';

const SYNC_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 5;

export const SyncService = {
  isSyncing: false,
  isRunning: false,
  intervalId: null as any,

  start: () => {
    if (SyncService.isRunning) {
      console.warn("⚠️ SyncService already running (Ignored)");
      return;
    }
    SyncService.isRunning = true;
    
    console.log("🔄 SyncService Started");
    
    // Periodical sync
    SyncService.intervalId = setInterval(() => {
      SyncService.processQueue();
    }, SYNC_INTERVAL);

    // Network status listeners
    window.addEventListener('online', () => {
      console.log("🌐 Device Online - Triggering Sync");
      SyncService.processQueue();
    });

    // Initial check
    SyncService.processQueue();
  },

  processQueue: async () => {
    if (SyncService.isSyncing) return;
    if (!navigator.onLine) return;

    // Solo procesar tareas PENDING que ya cumplieron su tiempo de espera
    const now = Date.now();
    const pendingTasks = await db.sync_queue
      .where('status')
      .equals('pending')
      .toArray();

    // Filtrar localmente por next_retry_at (Dexie filter es más simple aquí)
    const tasksToProcess = pendingTasks.filter(t => !t.next_retry_at || t.next_retry_at <= now).slice(0, 10);

    if (tasksToProcess.length === 0) return;

    SyncService.isSyncing = true;
    console.log(`📦 Processing ${tasksToProcess.length} sync tasks...`);

    for (const task of tasksToProcess) {
      await SyncService.processTask(task);
    }

    SyncService.isSyncing = false;
  },

  processTask: async (task: SyncTask) => {
    // Protección extra: solo procesar PENDING
    if (task.status !== 'pending') {
      console.warn("⚠️ SKIPPING TASK (Not pending):", task.id);
      return;
    }

    // Hard limit
    if ((task.retries || 0) >= MAX_RETRIES) {
      console.error("❌ TASK PERMANENTLY FAILED (Max retries reached):", task.id);
      await db.sync_queue.update(task.id, {
        status: 'failed',
        last_error: 'Max retries reached',
        failed_at: Date.now()
      });
      return;
    }

    try {
      console.log("WORKER PROCESSING TASK:", task.type, task.id);
      
      // 1. Pre-Sync Validation (Fail fast if payload is garbage)
      validateSyncPayload(task.payload);

      // Mark as processing
      await db.sync_queue.update(task.id, { status: 'processing' });

      let success = false;

      switch (task.type) {
        case 'CREATE_SALE':
          success = await SyncService.syncSale(task.payload);
          break;
        case 'UPDATE_STOCK':
          success = await SyncService.syncMovement();
          break;
        default:
          console.warn(`Unknown task type: ${task.type}`);
          success = true; 
      }

      if (success) {
        console.log("✅ SYNC SUCCESS:", task.id);
        await db.sync_queue.update(task.id, { 
          status: 'completed',
          synced_at: Date.now()
        });
        
        await SyncService.markEntitySynced(task);
      } else {
        throw new Error("Sync operation failed at remote");
      }

    } catch (error: any) {
      console.error("========== SYNC ERROR ==========");
      console.error("TASK ID:", task.id);
      console.error("TASK TYPE:", task.type);
      console.error("RETRIES:", task.retries || 0);
      console.error("PAYLOAD:", JSON.stringify(task.payload, null, 2));
      
      if (error?.message) console.error("MESSAGE:", error.message);

      const retries = (task.retries || 0) + 1;
      
      // If it's a validation error, don't retry, fail immediately
      const isValidationError = error?.message?.includes('UUID') || error?.message?.includes('Price') || error?.message?.includes('total');
      
      if (retries >= MAX_RETRIES || isValidationError) {
        console.error("❌ TASK PERMANENTLY FAILED (Validation or Retries):", task.id);
        await db.sync_queue.update(task.id, {
          status: 'failed',
          retries,
          last_error: error?.message || 'Sync error',
          failed_at: Date.now()
        });
      } else {
        const backoffMs = Math.pow(2, retries - 1) * 5000;
        const nextRetryAt = Date.now() + backoffMs;
        
        await db.sync_queue.update(task.id, {
          status: 'pending',
          retries,
          last_error: error?.message || 'Unknown sync error',
          next_retry_at: nextRetryAt
        });
      }
    }
  },

  syncSale: async (payload: CreateSalePayload) => {
    const { saleData, items } = payload;
    
    // 1. Re-validate items at sync time (FAIL FAST)
    const validItems = [];
    for (const item of items) {
      try {
        // This will throw if invalid
        validateSaleItemStrict(item);
        validItems.push(item);
      } catch (err: any) {
        console.error("[SYNC REJECTED ITEM]", item, err.message);
      }
    }

    // FIX: Sale MUST have at least one valid item to proceed
    if (validItems.length === 0) {
      console.error("[SYNC ABORTED] Sale has no valid items", { saleId: saleData.id });
      throw new Error("Sale has no valid items - aborting sync to prevent data corruption");
    }

    // 2. Strict Recalculation (MANDATORY)
    // Never trust saleData.total from potentially stale local state
    const calculatedTotal = validItems.reduce(
      (acc, item) => acc + (item.price_at_sale * item.quantity),
      0
    );

    if (calculatedTotal <= 0) {
      console.error("[SYNC ABORTED] Calculated total is zero or negative", { calculatedTotal });
      throw new Error("Sale total must be positive to sync");
    }

    // 3. Construct EXACT RPC payload (Variant-Only Model)
    const p_items = validItems.map((i: any) => ({
      variant_id: String(i.variant_id),
      quantity: Number(i.quantity),
      price_at_sale: Number(i.price_at_sale)
    }));

    const p_payments = saleData.payments || [];

    const p_sale = {
      id: String(saleData.id),
      user_id: String(saleData.user_id),
      store_id: String(saleData.store_id),
      total: calculatedTotal,
      payment_method: saleData.payment_method || 'Efectivo',
      cash_amount: Number(saleData.cash_amount || 0),
      credit_amount: Number(saleData.credit_amount || 0),
      store_credit_amount: Number(saleData.store_credit_amount || 0),
      vendedor: saleData.vendedor || 'Vendedor'
    };

    const rpcPayload = {
      p_items,
      p_payments,
      p_sale
    };

    console.log("RPC PAYLOAD FIXED", { p_items, p_payments, p_sale });
    console.log("🚀 [SYNC_CLOUD_START] Final Payload:", JSON.stringify(rpcPayload, null, 2));
    
    // Perform Cloud Sync
    await api.processSaleCloud(rpcPayload);
    return true;
  },

  syncMovement: async () => {
    // Implement movement sync if needed
    // For now, if sales are synced, stock is usually handled by the RPC
    return true; 
  },

  markEntitySynced: async (task: SyncTask) => {
    const now = Date.now();
    if (task.type === 'CREATE_SALE') {
      const saleId = task.payload.saleData.id;
      await db.sales.update(saleId, { sync_status: 'synced', synced_at: now });
      // Also items
      await db.sale_items.where('sale_id').equals(saleId).modify({ sync_status: 'synced', synced_at: now });
    }
  }
};
