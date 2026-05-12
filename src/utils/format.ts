export const formatCurrency = (value: number | undefined | null): string => {
  const safeValue = (typeof value === 'number' && !isNaN(value)) ? value : 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatDate = (dateValue: any): string => {
  // If dateValue is null or undefined, use current date as fallback
  const finalDateValue = (dateValue === null || dateValue === undefined) ? new Date() : dateValue;
  
  if (finalDateValue === 'No disponible') {
    return 'No disponible';
  }
  
  try {
    const date = new Date(finalDateValue);
    if (isNaN(date.getTime())) return 'Fecha inválida';

    // Standard app format: DD/MM/YYYY HH:mm
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch (error) {
    return 'Error de fecha';
  }
};

/**
 * Returns a YYYY-MM-DD string in LOCAL time.
 * Essential for Supabase queries that filter by date parts without timezones.
 */
export const getLocalISODate = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Smart size sorting utility.
 * Handles letter sizes (XS, S, M, L...) and numeric sizes (36, 38, 40...).
 */
export const compareSizes = (a: string, b: string) => {
  const sizeOrder: Record<string, number> = {
    'XXXS': 1, 'XXS': 2, 'XS': 3, 'S': 4, 'M': 5, 'L': 6, 'XL': 7, 'XXL': 8, 'XXXL': 9,
    'U': 100, 'UNICO': 100, 'ÚNICO': 100
  };
  
  const aUpper = String(a).toUpperCase();
  const bUpper = String(b).toUpperCase();
  
  if (sizeOrder[aUpper] !== undefined && sizeOrder[bUpper] !== undefined) {
    return sizeOrder[aUpper] - sizeOrder[bUpper];
  }
  
  const aNum = parseFloat(aUpper.split('/')[0].replace(/[^0-9.]/g, ''));
  const bNum = parseFloat(bUpper.split('/')[0].replace(/[^0-9.]/g, ''));
  
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum - bNum;
  }
  
  return aUpper.localeCompare(bUpper);
};


