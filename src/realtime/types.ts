
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type ListenerCallback<T extends { [key: string]: any } = any> = (payload: RealtimePostgresChangesPayload<T>) => void;

export type ListenerMap<T extends { [key: string]: any } = any> = Record<string, ListenerCallback<T>>;

export interface ChannelSubscriptionOptions {
  event?: string;
  schema?: string;
  table: string;
  filter?: string;
}

export interface ReconnectConfig {
  initialDelay: number;
  factor: number;
  maxDelay: number;
}
