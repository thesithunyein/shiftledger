import { isAddress, keccak256, toHex } from "viem";

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

export type AgentReport = {
  score: number;
  approved: boolean;
  summary: string;
  issues: ValidationIssue[];
  totalUsd: number;
  workerCount: number;
  payrollHash: `0x${string}`;
  analyzedAt: string;
};

const CSV_HEADER = "name,wallet,hours,rate_usd,role";

export function demoCsv(wallet?: string): string {
  const w = wallet ?? "0x0000000000000000000000000000000000000000";
  return `${CSV_HEADER}
Aung Min,${w},48,4.50,Line Operator
Siti Rahman,${w},52,5.00,QC Inspector
Raj Kumar,${w},44,4.75,Packaging Lead
Nurul Izza,${w},40,4.25,Logistics Handler
Tan Wei Ming,${w},36,6.00,Shift Supervisor`;
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
    const [name, wallet, hoursRaw, rateRaw, role] = parts;
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

/// AI-assisted payroll validation — deterministic rules engine (LLM-ready API shape).
export function runPayrollAgent(rows: PayrollRow[]): AgentReport {
  const issues: ValidationIssue[] = [];
  const wallets = new Map<string, number>();
  let totalUsd = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    totalUsd += row.amountUsd;

    if (!isAddress(row.wallet)) {
      issues.push({
        severity: "error",
        row: rowNum,
        field: "wallet",
        message: `${row.name}: invalid wallet address`,
      });
    } else {
      wallets.set(row.wallet.toLowerCase(), (wallets.get(row.wallet.toLowerCase()) ?? 0) + 1);
    }

    if (row.hours <= 0 || row.hours > 80) {
      issues.push({
        severity: "error",
        row: rowNum,
        field: "hours",
        message: `${row.name}: hours ${row.hours} outside allowed range (1–80)`,
      });
    } else if (row.hours > 60) {
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "hours",
        message: `${row.name}: ${row.hours}h exceeds typical shift — flagged for HR review`,
      });
    }

    if (row.rateUsd < 3 || row.rateUsd > 25) {
      issues.push({
        severity: "warning",
        row: rowNum,
        field: "rate_usd",
        message: `${row.name}: rate $${row.rateUsd}/hr unusual for SEA manufacturing band`,
      });
    }

    if (row.amountUsd > 500) {
      issues.push({
        severity: "warning",
        row: rowNum,
        message: `${row.name}: weekly payout $${row.amountUsd.toFixed(2)} exceeds auto-approve threshold`,
      });
    }
  });

  wallets.forEach((count, wallet) => {
    if (count > 1) {
      issues.push({
        severity: "info",
        message: `Wallet ${wallet.slice(0, 10)}… appears ${count}× in batch (valid for multi-role workers)`,
      });
    }
  });

  if (rows.length === 0) {
    issues.push({ severity: "error", message: "Payroll batch is empty" });
  }

  if (totalUsd > 10_000) {
    issues.push({
      severity: "error",
      message: `Batch total $${totalUsd.toFixed(2)} exceeds demo limit ($10,000)`,
    });
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8);
  const approved = errors === 0;

  let summary: string;
  if (!approved) {
    summary = `Agent blocked settlement: ${errors} critical issue(s) require fixes before on-chain batch.`;
  } else if (warnings > 0) {
    summary = `Agent approved with ${warnings} warning(s). Payroll is within policy; HR may review flagged rows.`;
  } else {
    summary = "Agent approved: payroll passes compliance checks. Ready for stablecoin batch settlement.";
  }

  return {
    score,
    approved,
    summary,
    issues,
    totalUsd,
    workerCount: rows.length,
    payrollHash: hashPayroll(rows),
    analyzedAt: new Date().toISOString(),
  };
}
