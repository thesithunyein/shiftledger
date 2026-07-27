import type { AgentReport, PayrollRow } from "./payrollAgent";

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

/** Structured agent reasoning trace — LLM API-ready output shape. */
export function buildAgentInsight(rows: PayrollRow[], report: AgentReport): AgentInsight {
  const overtime = rows.filter((r) => r.hours > 48);
  const highestPay = rows.reduce(
    (max, r) => (r.amountUsd > max.amountUsd ? r : max),
    rows[0] ?? { name: "—", amountUsd: 0, hours: 0, rateUsd: 0, wallet: "", role: "" }
  );

  const steps: AgentStep[] = [
    {
      id: "parse",
      label: "Parse shift roster",
      status: rows.length > 0 ? "done" : "fail",
      detail: rows.length > 0 ? `${rows.length} workers · shift payroll CSV` : "Empty roster",
    },
    {
      id: "wallets",
      label: "Verify worker wallets",
      status: report.policyChecks.find((c) => c.id === "wallets")?.passed ? "done" : "fail",
      detail: report.policyChecks.find((c) => c.id === "wallets")?.detail ?? "—",
    },
    {
      id: "compliance",
      label: "Industrial 5.0 compliance scan",
      status: report.issues.some((i) => i.severity === "error")
        ? "fail"
        : report.issues.some((i) => i.severity === "warning")
          ? "warn"
          : "done",
      detail:
        overtime.length > 0
          ? `${overtime.map((r) => r.name).join(", ")} flagged for overtime review`
          : "Hours and rates within SEA manufacturing policy",
    },
    {
      id: "risk",
      label: "Settlement risk score",
      status: report.approved ? (report.score >= 85 ? "done" : "warn") : "fail",
      detail: `Score ${report.score}/100 · batch $${report.totalUsd.toFixed(2)} sUSD`,
    },
    {
      id: "hash",
      label: "Bind payroll integrity hash",
      status: rows.length > 0 ? "done" : "fail",
      detail: `${report.payrollHash.slice(0, 10)}… → on-chain receipt anchor`,
    },
  ];

  let recommendation: string;
  if (!report.approved) {
    recommendation = `Do not settle. Resolve ${report.issues.filter((i) => i.severity === "error").length} blocking issue(s) before releasing stablecoin wages.`;
  } else if (overtime.length > 0) {
    recommendation = `Proceed with batch settlement. HR should confirm ${overtime[0].name}'s ${overtime[0].hours}h shift before next period. Highest payout: ${highestPay.name} ($${highestPay.amountUsd.toFixed(2)}).`;
  } else {
    recommendation = `All checks passed. Recommend immediate batch settlement for ${rows.length} workers ($${report.totalUsd.toFixed(2)} sUSD total).`;
  }

  const confidence = Math.min(99, Math.max(55, report.score + (report.approved ? 5 : -15)));

  return { steps, recommendation, confidence };
}

export const AGENT_ANALYSIS_MS = 1200;
