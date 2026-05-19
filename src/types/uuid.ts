/**
 * Centralized UUID type for the Arcadia POS architecture.
 * This type alias ensures that we are explicitly using string-based UUIDs
 * across the API, local database (Dexie), and UI components.
 */
export type UUID = string;

/**
 * Type guard to check if a value is a valid UUID string.
 */
export const isUUID = (val: any): val is UUID => {
  if (typeof val !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(val);
};
