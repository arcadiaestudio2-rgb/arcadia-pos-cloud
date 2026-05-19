import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../components/common/CommonUI';
import { validateCartItem } from '../utils/validation';

/**
 * ARCADIA CAUSAL ENGINE v5
 * Deterministic event-driven state machine with causal ordering.
 */

export interface CartEvent {
  id: string;
  sequence: number;
  source: 'ui' | 'realtime' | 'sync';
  type: 'ADD' | 'REMOVE' | 'UPDATE_QTY' | 'CLEAR' | 'HYDRATE';
  entityId?: string;
  payload: any;
  timestamp: number;
}

export interface CartState {
  items: any[];
  version: number;
  lastSequence: number;
  appliedEvents: string[]; // Event ID log
}

const CART_STATE_KEY = 'arcadia_cart_state_v5';

/**
 * PURE REDUCER (Causal Version)
 */
const cartReducer = (state: CartState, event: CartEvent): CartState => {
  let nextItems = [...state.items];

  switch (event.type) {
    case 'ADD': {
      const validated = event.payload;
      const idx = nextItems.findIndex(i => i.variant_id === validated.variant_id);
      if (idx > -1) {
        nextItems[idx] = { ...nextItems[idx], quantity: nextItems[idx].quantity + 1 };
      } else {
        nextItems.push({ ...validated, quantity: 1 });
      }
      break;
    }
    case 'REMOVE': {
      nextItems = nextItems.filter(i => i.variant_id !== event.entityId);
      break;
    }
    case 'UPDATE_QTY': {
      const idx = nextItems.findIndex(i => i.variant_id === event.entityId);
      if (idx > -1) {
        const newQty = nextItems[idx].quantity + event.payload.delta;
        if (newQty <= 0) {
          nextItems = nextItems.filter(i => i.variant_id !== event.entityId);
        } else {
          nextItems[idx] = { ...nextItems[idx], quantity: newQty };
        }
      }
      break;
    }
    case 'CLEAR': {
      nextItems = [];
      break;
    }
    case 'HYDRATE': {
      nextItems = (event.payload || []).map((item: any) => validateCartItem(item));
      break;
    }
  }

  // Pure Purification (Variant-Only Model)
  nextItems = nextItems.map(item => {
    const cleaned = { ...item };
    delete (cleaned as any).variantId;
    delete (cleaned as any).productId;
    delete (cleaned as any).product_id; // Explicit removal
    delete (cleaned as any).price;
    return cleaned;
  });

  return {
    items: nextItems,
    version: state.version + 1,
    lastSequence: event.sequence,
    appliedEvents: [...state.appliedEvents.slice(-100), event.id] // Keep last 100 for dedup
  };
};

export function useCart() {
  const [state, setState] = useState<CartState>(() => {
    const saved = localStorage.getItem(CART_STATE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          appliedEvents: parsed.appliedEvents || []
        };
      } catch (e) {}
    }
    return { items: [], version: 0, lastSequence: -1, appliedEvents: [] };
  });

  const [isHydrated, setIsHydrated] = useState(false);
  const sequenceRef = useRef(state.lastSequence);

  // Sync sequenceRef
  useEffect(() => {
    sequenceRef.current = state.lastSequence;
    setIsHydrated(true);
  }, [state.lastSequence]);

  // Persistence (Write)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(CART_STATE_KEY, JSON.stringify(state));
    }
  }, [state, isHydrated]);

  /**
   * COMMIT PIPELINE (The Consistency Guard)
   */
  const commitCartEvent = useCallback((event: CartEvent) => {
    // 1. DEDUPLICATION (UUID)
    if (state.appliedEvents.includes(event.id)) {
      console.warn(`🛑 [CAUSAL_ENGINE] Duplicate event rejected: ${event.id}`);
      return;
    }

    // 2. CAUSAL ORDERING (SEQUENCE)
    // Only apply if the event is newer than the last applied one.
    // This protects against out-of-order Realtime updates.
    if (event.sequence <= state.lastSequence && event.type !== 'HYDRATE') {
      console.warn(`⏳ [CAUSAL_ENGINE] Stale event ignored: ${event.sequence} <= ${state.lastSequence}`);
      return;
    }

    // 3. VALIDATION (FAIL-FAST)
    if (event.type === 'ADD') {
      try {
        event.payload = validateCartItem(event.payload);
      } catch (e: any) {
        toast.error(e.message);
        return;
      }
    }

    // 4. ATOMIC COMMIT
    setState(prev => cartReducer(prev, event));
    console.log(`💎 [CAUSAL_COMMIT] ${event.type} | Seq: ${event.sequence} | Source: ${event.source}`);
  }, [state]);

  // Public Actions
  const addItem = useCallback((item: any) => {
    const nextSeq = sequenceRef.current + 1;
    commitCartEvent({
      id: crypto.randomUUID(),
      sequence: nextSeq,
      source: 'ui',
      type: 'ADD',
      entityId: item.variant_id || item.id,
      payload: item,
      timestamp: Date.now()
    });
  }, [commitCartEvent]);

  const removeItem = useCallback((variant_id: string) => {
    const nextSeq = sequenceRef.current + 1;
    commitCartEvent({
      id: crypto.randomUUID(),
      sequence: nextSeq,
      source: 'ui',
      type: 'REMOVE',
      entityId: variant_id,
      payload: null,
      timestamp: Date.now()
    });
  }, [commitCartEvent]);

  const updateQty = useCallback((variant_id: string, delta: number) => {
    const nextSeq = sequenceRef.current + 1;
    commitCartEvent({
      id: crypto.randomUUID(),
      sequence: nextSeq,
      source: 'ui',
      type: 'UPDATE_QTY',
      entityId: variant_id,
      payload: { delta },
      timestamp: Date.now()
    });
  }, [commitCartEvent]);

  const clearCart = useCallback(() => {
    const nextSeq = sequenceRef.current + 1;
    commitCartEvent({
      id: crypto.randomUUID(),
      sequence: nextSeq,
      source: 'ui',
      type: 'CLEAR',
      payload: null,
      timestamp: Date.now()
    });
  }, [commitCartEvent]);

  return {
    cart: state.items,
    state,
    addItem,
    removeItem,
    updateQty,
    clearCart,
    commitCartEvent // Exposed for Realtime/Sync sources
  };
}
