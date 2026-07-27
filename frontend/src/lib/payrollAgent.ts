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

/** Demo roster — KL factory, Week 30. Siti flagged for 52h overtime. */
export function demoCsv(viewerWallet?: string): string {
  const you = normalizeWallet(viewerWallet ?? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const siti = normalizeWallet("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const raj = normalizeWallet("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  const nurul = normalizeWallet("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");
  const tan = normalizeWallet("0x9965507D1a55BcC2695c58Ba16Eb3D46B0D6f814");
  return `${CSV_HEADER}
Aung Min,${you},48,4.50,Line Operator
Siti Rahman,${siti},52,5.00,QC Inspector
Raj Kumar,${raj},44,4.75,Packaging Lead
Nurul Izza,${nurul},40,4.25,Logistics Handler
Tan Wei Ming,${tan},36,6.00,Shift Supervisor`;
}

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
        message: `${row.name}: invalid wallet — worker cannot receive on-chain receipt`,
      });
    } else {
      wallets.set(row.wallet.toLowerCase(), (wallets.get(row.wallet.toLowerCase()) ?? 0) + 1);
    }

    if (row.hours <= 0 || row.hours > 80) {
      issues.push({
        severity: "error",
        row: rowNum,
        field: "hours",
        message: `${row.name}: ${row.hours}h outside policy (1–80h/week)`,
      });
    } else if (row.hours > 48) {
      overtimeRows++;
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "hours",
        message: `${row.name}: ${row.hours}h exceeds standard shift — HR review recommended (Industrial 5.0 compliance)`,
      });
    }

    if (row.rateUsd < 3 || row.rateUsd > 25) {
      rateAnomalies++;
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "rate_usd",
        message: `${row.name}: $${row.rateUsd}/hr outside SEA manufacturing wage band`,
      });
    }

    if (row.amountUsd > 500) {
      issues.push({
        severity: "warning",
        row: rowNum,
        message: `${row.name}: $${row.amountUsd.toFixed(2)} exceeds auto-approve threshold ($500)`,
      });
    }
  });

  if (rows.length === 0) {
    issues.push({ severity: "error", message: "Empty payroll batch" });
  }

  if (totalUsd > 10_000) {
    issues.push({
      severity: "error",
      message: `Batch total $${totalUsd.toFixed(2)} exceeds demo ceiling ($10,000)`,
    });
  }

  const policyChecks: PolicyCheck[] = [
    {
      id: "wallets",
      label: "Worker wallet validity",
      passed: invalidWallets === 0 && rows.length > 0,
      detail: invalidWallets === 0 ? `${rows.length} valid addresses` : `${invalidWallets} invalid`,
    },
    {
      id: "hours",
      label: "Shift hour compliance",
      passed: !issues.some((i) => i.field === "hours" && i.severity === "error"),
      detail: overtimeRows > 0 ? `${overtimeRows} overtime flag(s)` : "Within limits",
    },
    {
      id: "rates",
      label: "SEA wage band check",
      passed: rateAnomalies === 0,
      detail: rateAnomalies === 0 ? "Rates normal" : `${rateAnomalies} anomaly(s)`,
    },
    {
      id: "batch",
      label: "Batch total & roster size",
      passed: rows.length > 0 && totalUsd <= 10_000,
      detail: `$${totalUsd.toFixed(2)} · ${rows.length} workers`,
    },
    {
      id: "hash",
      label: "Payroll integrity hash",
      passed: rows.length > 0,
      detail: "Bound to on-chain settlement",
    },
  ];

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);
  const approved = errors === 0;

  let summary: string;
  if (!approved) {
    summary = `Blocked: ${errors} critical issue(s). Fix roster before stablecoin settlement.`;
  } else if (warnings > 0) {
    summary = `Approved with ${warnings} review flag(s). Safe to settle — HR should verify overtime rows.`;
  } else {
    summary = "Approved. Payroll passes all policy checks. Ready for batch settlement.";
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
