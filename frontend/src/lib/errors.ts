/** User-facing payment / wallet errors (no raw chain dumps). */
export function friendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/user rejected|denied|user cancelled|rejected the request/i.test(msg)) {
    return "Cancelled in your account. Nothing was paid.";
  }
  if (/insufficient funds|exceeds balance|transfer amount exceeds/i.test(msg)) {
    return "Not enough payout balance. Add testnet funds, then try again.";
  }
  if (/network|chain|wrong network/i.test(msg)) {
    return "Wrong network. Switch to the payout network, then retry.";
  }
  if (/connector|provider|no ethereum/i.test(msg)) {
    return "No payout account found. Install a browser wallet, then sign in.";
  }
  return "Something went wrong. Please try again.";
}
