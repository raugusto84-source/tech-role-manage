// Utility functions for MXN currency formatting with business rounding rules
export const ceilToTen = (amount: number): number => {
  if (!isFinite(amount)) return 0;
  // Always round up to the next multiple of 10
  const factor = 10;
  return Math.ceil(amount / factor) * factor;
};

export const formatCOPCeilToTen = (amount: number): string => {
  const rounded = ceilToTen(amount);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
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

// Format cashback without rounding - for reward amounts
export const formatMXNCashback = (amount: number): string => {
  if (!isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
