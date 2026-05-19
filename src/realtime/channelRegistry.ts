
import { RealtimeChannel } from '@supabase/supabase-js';
import { logRealtime } from '../utils/realtimeLogger';

const channelRegistry = new Map<string, RealtimeChannel>();

export const getChannelFromRegistry = (name: string): RealtimeChannel | undefined => {
  return channelRegistry.get(name);
};

export const registerChannel = (name: string, channel: RealtimeChannel, isNew: boolean): void => {
  channelRegistry.set(name, channel);
  if (isNew) {
    logRealtime('REALTIME_CREATE', name);
  } else {
    logRealtime('REALTIME_REUSE', name);
  }
};

export const removeChannelFromRegistry = (name: string): void => {
  channelRegistry.delete(name);
  logRealtime('REALTIME_REMOVE', name);
};

export const clearChannelRegistry = (): void => {
  channelRegistry.clear();
};
