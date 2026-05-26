/**
 * Indian Rupee currency formatter.
 *
 * Centralised so every salary / earnings / dashboard surface formats
 * money the same way. Future SPIM Suite integration will reuse this
 * helper for any currency value returned from the desktop ERP.
 *
 * Examples:
 *   formatINR(25000)    -> "₹ 25,000"
 *   formatINR(125500)   -> "₹ 1,25,500"
 *   formatINR(0)        -> "₹ 0"
 *   formatINR(1234.56)  -> "₹ 1,234.56"
 */

export const RUPEE_SYMBOL = '₹';

/**
 * Format a number as Indian Rupees using lakh / crore grouping.
 * Returns "₹ <amount>" with a non-breaking space between the symbol
 * and the digits to keep them on the same line.
 */
export function formatINR(amount: number, options?: { decimals?: number }): string {
  const decimals = options?.decimals ?? 0;
  if (!Number.isFinite(amount)) return `${RUPEE_SYMBOL} 0`;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${RUPEE_SYMBOL} ${formatted}`;
}

/**
 * Format a per-day rate ("₹ 1,000 / day").
 */
export function formatINRPerDay(amount: number): string {
  return `${formatINR(amount)} / day`;
}

/**
 * Format a progress pair ("₹ 700 / ₹ 30,000").
 */
export function formatINRProgress(current: number, total: number): string {
  return `${formatINR(current)} / ${formatINR(total)}`;
}
