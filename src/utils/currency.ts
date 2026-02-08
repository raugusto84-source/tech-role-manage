// Utility functions for MXN currency formatting with business rounding rules
export const ceilToTen = (amount: number): number => {
  if (!isFinite(amount)) return 0;
  // No rounding - return exact amount
  return amount;
};

export const formatCOPCeilToTen = (amount: number): string => {
  if (!isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format 0-decimal amount without business rounding (standard rounding)
export const formatMXNInt = (amount: number): string => {
  if (!isFinite(amount)) return '$0';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format exact amount without rounding - for precise totals
export const formatMXNExact = (amount: number): string => {
  if (!isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format cashback - REMOVED: cashback system eliminated
export const formatMXNCashback = (amount: number): string => {
  return formatMXNExact(0); // Always return 0 since cashback is eliminated
};
