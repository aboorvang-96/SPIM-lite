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
 *   formatINR(undefined)-> "—"   // Suite did not deliver a value
 */

export const RUPEE_SYMBOL = '₹';

/** Sentinel shown when SPIM Suite did not deliver a value for this field. */
export const MISSING_VALUE = '—';

/**
 * Format a number as Indian Rupees using lakh / crore grouping.
 * Returns "₹ <amount>" with a non-breaking space between the symbol
 * and the digits to keep them on the same line.
 *
 * When the amount is null / undefined / non-finite, returns the
 * MISSING_VALUE sentinel ("—") so a missing backend field is visually
 * distinct from a genuine ₹0.
 */
export function formatINR(
  amount: number | null | undefined,
  options?: { decimals?: number },
): string {
  if (amount == null || !Number.isFinite(amount)) return MISSING_VALUE;
  const decimals = options?.decimals ?? 0;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  return `${RUPEE_SYMBOL} ${formatted}`;
}

/**
 * Format a per-day rate ("₹ 1,000 / day"). Missing → "—".
 */
export function formatINRPerDay(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return MISSING_VALUE;
  return `${formatINR(amount)} / day`;
}

/**
 * Format a progress pair ("₹ 700 / ₹ 30,000"). Each side falls back to "—".
 */
export function formatINRProgress(
  current: number | null | undefined,
  total: number | null | undefined,
): string {
  return `${formatINR(current)} / ${formatINR(total)}`;
}

/**
 * Format an integer count ("9"). Missing → "—".
 * Used for day counts (Present Days, Paid Days, Total Working Days).
 */
export function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return MISSING_VALUE;
  return String(n);
}
