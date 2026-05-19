/**
 * Business Logic Formulas (CEO Mandated - Argentine Compliance)
 * Unifies pricing calculations across the application.
 */

export const IVA_DEFAULT = 21;

/**
 * Calculates PVP based on cost, margin and IVA.
 * Formula: Math.round( (cost * (1 + iva/100)) * (1 + margin/100) )
 */
export const calculatePVP = (cost: number, margin: number, iva: number = IVA_DEFAULT): number => {
  const costWithIva = cost * (1 + iva / 100);
  return Math.round(costWithIva * (1 + margin / 100));
};

/**
 * Calculates Margin based on cost, PVP and IVA.
 * Formula: ((pvp / (cost * (1 + iva/100))) - 1) * 100
 */
export const calculateMargin = (cost: number, pvp: number, iva: number = IVA_DEFAULT): number => {
  if (cost <= 0) return 0;
  const costWithIva = cost * (1 + iva / 100);
  return ((pvp / costWithIva) - 1) * 100;
};

/**
 * Calculates Cost based on PVP, margin and IVA.
 * Formula: pvp / ((1 + margin/100) * (1 + iva/100))
 */
export const calculateCost = (pvp: number, margin: number, iva: number = IVA_DEFAULT): number => {
  const denominator = (1 + margin / 100) * (1 + iva / 100);
  if (denominator <= 0) return 0;
  return pvp / denominator;
};

/**
 * Calculates Debit price based on Effective price and surcharge.
 */
export const calculateDebitPrice = (pvpEffective: number, surcharge: number): number => {
  return Math.round(pvpEffective * (1 + surcharge / 100));
};

/**
 * Calculates Credit price based on Effective price and surcharge.
 */
export const calculateCreditPrice = (pvpEffective: number, surcharge: number): number => {
  return Math.round(pvpEffective * (1 + surcharge / 100));
};

/**
 * Aliases for ProductEditor compatibility (maintain legacy naming)
 */
export const calculatePriceCash = calculatePVP;
export const calculatePriceDebit = calculateDebitPrice;
export const calculatePriceCredit = calculateCreditPrice;
