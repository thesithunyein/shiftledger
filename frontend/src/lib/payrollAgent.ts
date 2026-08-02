import { getAddress, isAddress, keccak256, toHex } from "viem";

export type PayrollRow = {
  name: string;
  wallet: string;
  hours: number;
  rateUsd: number;
  role: string;
  amountUsd: number;
};

export type ValidationIssue = {
  severity: "error" | "warning" | "info";
  row?: number;
  field?: string;
  message: string;
};

export type PolicyCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type AgentReport = {
  score: number;
  approved: boolean;
  summary: string;
  issues: ValidationIssue[];
  policyChecks: PolicyCheck[];
  totalUsd: number;
  workerCount: number;
  payrollHash: `0x${string}`;
  analyzedAt: string;
};

const CSV_HEADER = "name,wallet,hours,rate_usd,role";

function normalizeWallet(value: string): string {
  const raw = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return raw;
  try {
    return getAddress(raw.toLowerCase() as `0x${string}`);
  } catch {
    return raw;
  }
}

/** Empty CSV template for HR import (no invented workers). */
export function csvTemplate(): string {
  return `${CSV_HEADER}\n`;
}

export { CSV_HEADER };

export function parsePayrollCsv(text: string): PayrollRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  if (!header.includes("wallet") || !header.includes("hours")) {
    throw new Error("CSV must include: name,wallet,hours,rate_usd,role");
  }

  return lines.slice(1).map((line) => {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 5) throw new Error(`Invalid row: ${line}`);
    const [name, walletRaw, hoursRaw, rateRaw, role] = parts;
    const wallet = normalizeWallet(walletRaw);
    const hours = Number(hoursRaw);
    const rateUsd = Number(rateRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(rateUsd)) {
      throw new Error(`Invalid numbers in row for ${name}`);
    }
    const amountUsd = Math.round(hours * rateUsd * 100) / 100;
    return { name, wallet, hours, rateUsd, role, amountUsd };
  });
}

function hashPayroll(rows: PayrollRow[]): `0x${string}` {
  const payload = rows.map((r) => `${r.wallet}:${r.amountUsd}:${r.role}`).join("|");
  return keccak256(toHex(payload));
}

/** Payroll Intelligence Agent — policy engine for Industrial 5.0 shift payroll (LLM API-ready). */
export function runPayrollAgent(rows: PayrollRow[]): AgentReport {
  const issues: ValidationIssue[] = [];
  const wallets = new Map<string, number>();
  let totalUsd = 0;
  let invalidWallets = 0;
  let overtimeRows = 0;
  let rateAnomalies = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    totalUsd += row.amountUsd;

    if (!isAddress(row.wallet)) {
      invalidWallets++;
      issues.push({
        severity: "error",
        row: rowNum,
        field: "wallet",
        message: `${row.name}: payout account invalid — worker cannot receive payment proof`,
      });
    } else {
      wallets.set(row.wallet.toLowerCase(), (wallets.get(row.wallet.toLowerCase()) ?? 0) + 1);
    }

    if (row.hours <= 0 || row.hours > 80) {
      issues.push({
        severity: "error",
        row: rowNum,
        field: "hours",
        message: `${row.name}: ${row.hours}h outside factory policy (1–80h/week)`,
      });
    } else if (row.hours > 48) {
      overtimeRows++;
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "hours",
        message: `${row.name}: ${row.hours}h overtime — HR should review before next shift week`,
      });
    }

    if (row.rateUsd < 3 || row.rateUsd > 25) {
      rateAnomalies++;
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "rate_usd",
        message: `${row.name}: $${row.rateUsd}/hr looks unusual for SEA factory wages`,
      });
    }

    if (row.amountUsd > 500) {
      issues.push({
        severity: "warning",
        row: rowNum,
        message: `${row.name}: $${row.amountUsd.toFixed(2)} above auto-approve limit ($500)`,
      });
    }
  });

  if (rows.length === 0) {
    issues.push({ severity: "error", message: "Roster is empty" });
  }

  if (totalUsd > 10_000) {
    issues.push({
      severity: "error",
      message: `Payroll total $${totalUsd.toFixed(2)} exceeds batch limit ($10,000)`,
    });
  }

  const policyChecks: PolicyCheck[] = [
    {
      id: "wallets",
      label: "Payout accounts",
      passed: invalidWallets === 0 && rows.length > 0,
      detail: invalidWallets === 0 ? `${rows.length} ready to pay` : `${invalidWallets} invalid`,
    },
    {
      id: "hours",
      label: "Shift hours",
      passed: !issues.some((i) => i.field === "hours" && i.severity === "error"),
      detail: overtimeRows > 0 ? `${overtimeRows} overtime flag(s)` : "Within policy",
    },
    {
      id: "rates",
      label: "Wage rates",
      passed: rateAnomalies === 0,
      detail: rateAnomalies === 0 ? "Rates look normal" : `${rateAnomalies} to review`,
    },
    {
      id: "batch",
      label: "Batch size",
      passed: rows.length > 0 && totalUsd <= 10_000,
      detail: `$${totalUsd.toFixed(2)} · ${rows.length} workers`,
    },
    {
      id: "hash",
      label: "Payment proof record",
      passed: rows.length > 0,
      detail: "Ready to attach to payslips",
    },
  ];

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);
  const approved = errors === 0;

  let summary: string;
  if (!approved) {
    summary = `Blocked: ${errors} critical issue(s). Fix the roster before paying workers.`;
  } else if (warnings > 0) {
    summary = `Ready to pay with ${warnings} HR flag(s). Overtime rows should be reviewed.`;
  } else {
    summary = "Approved. Roster looks clean. Ready to pay this shift week.";
  }

  return {
    score,
    approved,
    summary,
    issues,
    policyChecks,
    totalUsd,
    workerCount: rows.length,
    payrollHash: hashPayroll(rows),
    analyzedAt: new Date().toISOString(),
  };
}
