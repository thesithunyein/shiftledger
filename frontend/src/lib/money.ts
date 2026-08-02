/** Display helpers for non-crypto users (approx MYR for SEA payroll context). */
export const USD_TO_MYR = 4.7;

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatMyr(amountUsd: number): string {
  return `RM ${(amountUsd * USD_TO_MYR).toFixed(2)}`;
}

export function formatPay(amountUsd: number): string {
  return `${formatUsd(amountUsd)} · ${formatMyr(amountUsd)}`;
}
