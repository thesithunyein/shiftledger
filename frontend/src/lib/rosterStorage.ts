import type { PayrollRow } from "./payrollAgent";

const KEY = "shiftledger-roster-v1";

export type StoredRoster = {
  factoryName: string;
  shiftPeriod: string;
  rows: PayrollRow[];
};

export function loadRoster(): StoredRoster | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRoster;
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRoster(data: StoredRoster) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function clearRoster() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
