
import { createClient, SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logRealtime } from '../utils/realtimeLogger';
import { getChannelFromRegistry, registerChannel, removeChannelFromRegistry, clearChannelRegistry } from './channelRegistry';
import { ReconnectConfig } from './types';

const SUPABASE_URL = 'https://pzlkzoemyfefwgaywegn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGt6b2VteWZlZndnYXl3ZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDUwNDQsImV4cCI6MjA5MTkyMTA0NH0.Xf5uKEQ0ztv1xWbt5ZwFraMMRQXMOsI3pE6jYYWCGz4';

let supabaseInstance: SupabaseClient | null = null;
let reconnectTimer: number | null = null;
let retryCount = 0;

const RECONNECT_CONFIG: ReconnectConfig = {
  initialDelay: 500,
  factor: 2,
  maxDelay: 30000
};

// Internal listener registry to handle multiple listeners per channel
// Map<channelName, Map<listenerKey, Set<callback>>>
const internalListeners = new Map<string, Map<string, Set<(payload: any) => void>>>();

// Keep track of which keys are already registered on the actual Supabase channel
const registeredKeys = new Map<string, Set<string>>();

/**
 * Lazily initialize the singleton Supabase client
 */
export const getClient = (): SupabaseClient => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
        // v2 way of monitoring connection health
        heartbeatCallback: (status: any) => {
          if (status === 'ok') {
            logRealtime('REALTIME_READY');
            resetRetryCounter();
          } else if (status === 'timeout' || status === 'error') {
            logRealtime('REALTIME_CLOSED');
            scheduleReconnect();
          }
        }
      },
    });

    logRealtime('REALTIME_INIT');
  }
  return supabaseInstance;
};

/**
 * Get or create a channel from the registry
 */
export const getOrCreateChannel = (name: string): RealtimeChannel => {
  const existing = getChannelFromRegistry(name);
  if (existing) {
    return existing;
  }

  const client = getClient();
  const channel = client.channel(name);
  registerChannel(name, channel, true);
  return channel;
};

/**
 * Subscribe to a channel with listeners.
 * Ensures listeners are attached BEFORE subscribe().
 */
export const subscribeChannel = <T extends { [key: string]: any } = any>(
  channelName: string, 
  options: { event: string; schema: string; table: string; filter?: string },
  callback: (payload: RealtimePostgresChangesPayload<T>) => void
): void => {
  const listenerKey = `${options.event}:${options.schema}:${options.table}:${options.filter || ''}`;
  
  // 1. Manage internal listeners
  if (!internalListeners.has(channelName)) {
    internalListeners.set(channelName, new Map());
  }
  const channelListeners = internalListeners.get(channelName)!;
  
  if (!channelListeners.has(listenerKey)) {
    channelListeners.set(listenerKey, new Set());
  }
  const callbacks = channelListeners.get(listenerKey)!;
  callbacks.add(callback);

  // 2. Get or create channel
  const channel = getOrCreateChannel(channelName);

  // 3. Check if we need to attach the .on() listener to the channel
  if (!registeredKeys.has(channelName)) {
    registeredKeys.set(channelName, new Set());
  }
  const channelRegisteredKeys = registeredKeys.get(channelName)!;

  if (!channelRegisteredKeys.has(listenerKey)) {
    logRealtime('REALTIME_SUBSCRIBE', channelName, options);
    
    // Safety check: if adding after subscribe, we might need to handle it.
    // But our architecture tries to avoid this.
    channel.on(
      'postgres_changes' as any,
      options as any,
      (payload: RealtimePostgresChangesPayload<T>) => {
        const currentCallbacks = internalListeners.get(channelName)?.get(listenerKey);
        currentCallbacks?.forEach(cb => cb(payload));
      }
    );
    
    channelRegisteredKeys.add(listenerKey);
    
    // Only subscribe if not already joined or joining
    // We use a timeout to allow multiple .on() calls in the same tick before subscribing
    if (channel.state === 'closed' || channel.state === 'errored') {
      setTimeout(() => {
        if (channel.state === 'closed' || channel.state === 'errored') {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              logRealtime('REALTIME_READY', channelName);
            }
            if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              logRealtime('REALTIME_ERROR', channelName, status);
            }
          });
        }
      }, 0);
    }
  }
};

/**
 * Remove a listener from a channel.
 * If no more listeners, removes the channel.
 */
export const removeChannel = (channelName: string, options: { event: string; schema: string; table: string; filter?: string }, callback: (payload: any) => void): void => {
  const listenerKey = `${options.event}:${options.schema}:${options.table}:${options.filter || ''}`;
  const channelListeners = internalListeners.get(channelName);
  
  if (channelListeners) {
    const callbacks = channelListeners.get(listenerKey);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        channelListeners.delete(listenerKey);
      }
    }

    if (channelListeners.size === 0) {
      const channel = getChannelFromRegistry(channelName);
      if (channel) {
        channel.unsubscribe();
        removeChannelFromRegistry(channelName);
      }
      internalListeners.delete(channelName);
      registeredKeys.delete(channelName);
    }
  }
};

const resetRetryCounter = () => {
  retryCount = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer) return;

  const delay = Math.min(
    RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.factor, retryCount),
    RECONNECT_CONFIG.maxDelay
  );

  logRealtime('REALTIME_RECONNECT', undefined, { delay, attempt: retryCount + 1 });

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    retryCount++;
    performReconnect();
  }, delay);
};

const performReconnect = () => {
  logRealtime('REALTIME_INIT', 'Reconnecting...');
  
  // Re-initialize client if needed or just let it try to reconnect its own socket
  // Supabase client usually handles socket reconnection, but we might need to 
  // re-subscribe channels if they were closed.
  
  // Optionally clear and re-subscribe everything if the connection was totally lost
  // but usually Supabase Realtime manages re-subscription of channels that were 'joined'.
  // However, the requirements say "clean old channels" and "restore listeners safely".
  
  const currentListeners = new Map(internalListeners);
  
  // Clear registry and recreate
  clearChannelRegistry();
  internalListeners.clear();
  registeredKeys.clear();
  
  // Re-subscribe everything
  currentListeners.forEach((listenersMap, channelName) => {
    listenersMap.forEach((callbacks, listenerKey) => {
      const [event, schema, table, filter] = listenerKey.split(':');
      callbacks.forEach(cb => {
        subscribeChannel(channelName, { event, schema, table, filter }, cb);
      });
    });
  });
};

/**
 * Global initialization for application-wide realtime channels.
 */
export const initAppRealtime = async () => {
  const client = getClient();
  const { data: { user } } = await client.auth.getUser();
  const storeId = user?.id;

  if (!storeId) {
    logRealtime('REALTIME_ERROR', undefined, 'No authenticated user for app init');
    return;
  }

  logRealtime('REALTIME_INIT', 'App-wide channels');

  const inventoryOptions = { 
    event: '*', 
    schema: 'public', 
    table: 'variants', 
    filter: `store_id=eq.${storeId}` 
  };

  const movementOptions = { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'movements', 
    filter: `store_id=eq.${storeId}` 
  };

  const syncCallback = () => {
    logRealtime('REALTIME_READY', 'inventory-sync-realtime', 'Dispatching sync event');
    window.dispatchEvent(new CustomEvent('arcadia:inventory:sync'));
  };

  subscribeChannel('inventory-sync-realtime', inventoryOptions, syncCallback);
  subscribeChannel('inventory-sync-realtime', movementOptions, syncCallback);
};
