
import { getClient } from '../realtime/realtimeBootstrap';

/**
 * SINGLETON Supabase Client
 * This instance is managed by the Realtime Manager to ensure 
 * only one websocket connection exists across the entire app.
 */
export const supabase = getClient();
