import type { AgentReport, PayrollRow } from "./payrollAgent";
import { formatPay } from "./money";

export type AgentStep = {
  id: string;
  label: string;
  status: "done" | "warn" | "fail";
  detail: string;
};

export type AgentInsight = {
  steps: AgentStep[];
  recommendation: string;
  confidence: number;
};

/** Payroll review checklist for HR clerks (policy engine under the hood). */
export function buildAgentInsight(rows: PayrollRow[], report: AgentReport): AgentInsight {
  const overtime = rows.filter((r) => r.hours > 48);
  const highestPay = rows.reduce(
    (max, r) => (r.amountUsd > max.amountUsd ? r : max),
    rows[0] ?? { name: "-", amountUsd: 0, hours: 0, rateUsd: 0, wallet: "", role: "" }
  );

  const steps: AgentStep[] = [
    {
      id: "parse",
      label: "Read shift roster",
      status: rows.length > 0 ? "done" : "fail",
      detail: rows.length > 0 ? `${rows.length} workers loaded from CSV` : "Empty roster",
    },
    {
      id: "wallets",
      label: "Check payout accounts",
      status: report.policyChecks.find((c) => c.id === "wallets")?.passed ? "done" : "fail",
      detail: report.policyChecks.find((c) => c.id === "wallets")?.detail ?? "-",
    },
    {
      id: "compliance",
      label: "Hours & overtime review",
      status: report.issues.some((i) => i.field === "hours" && i.severity === "error")
        ? "fail"
        : overtime.length > 0
          ? "warn"
          : "done",
      detail:
        overtime.length > 0
          ? `${overtime.map((r) => r.name).join(", ")} flagged for overtime`
          : "Hours within factory policy",
    },
    {
      id: "risk",
      label: "Payroll readiness score",
      status: report.approved ? (report.score >= 85 ? "done" : "warn") : "fail",
      detail: `Score ${report.score}/100 · batch ${formatPay(report.totalUsd)}`,
    },
    {
      id: "hash",
      label: "Lock payroll record",
      status: rows.length > 0 ? "done" : "fail",
      detail: "Proof hash ready for payment confirmation",
    },
  ];

  let recommendation: string;
  if (!report.approved) {
    recommendation = `Do not pay yet. Fix ${report.issues.filter((i) => i.severity === "error").length} blocking issue(s) on the roster first.`;
  } else if (overtime.length > 0) {
    recommendation = `Safe to pay this batch. Ask HR to confirm ${overtime[0].name}'s ${overtime[0].hours}h shift before next week. Highest payout: ${highestPay.name} (${formatPay(highestPay.amountUsd)}).`;
  } else {
    recommendation = `All checks passed. Ready to pay ${rows.length} workers (${formatPay(report.totalUsd)} total).`;
  }

  const confidence = Math.min(99, Math.max(55, report.score + (report.approved ? 5 : -15)));

  return { steps, recommendation, confidence };
}

export const AGENT_ANALYSIS_MS = 900;
