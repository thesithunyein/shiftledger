import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits, type Hex } from "viem";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  Factory,
  Loader2,
  Plus,
  Receipt,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { SiteBar } from "./components/SiteBar";
import { SiteFooter } from "./components/SiteFooter";
import { useTheme } from "./hooks/useTheme";
import { erc20Abi, shiftLedgerAbi } from "./lib/abis";
import { explorerAddr, explorerTx, getDeployment, isDeployed, shortAddr } from "./lib/deployment";
import { csvTemplate, parsePayrollCsv, runPayrollAgent, type AgentReport, type PayrollRow } from "./lib/payrollAgent";
import { AGENT_ANALYSIS_MS, buildAgentInsight, type AgentInsight } from "./lib/agentInsight";
import { formatMyr, formatPay, formatUsd } from "./lib/money";
import { friendlyError } from "./lib/errors";
import { clearRoster, loadRoster, saveRoster } from "./lib/rosterStorage";

type Tab = "employer" | "worker";
const SEPOLIA = 11155111;

function currentPayPeriod(): string {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

const emptyDraft = {
  name: "",
  role: "",
  hours: "40",
  rateUsd: "4.50",
  wallet: "",
};

export function App() {
  const d = getDeployment();
  const deployed = isDeployed(d);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { theme, toggleTheme } = useTheme();

  const [tab, setTab] = useState<Tab>("employer");
  const [shiftPeriod, setShiftPeriod] = useState(currentPayPeriod);
  const [factoryName, setFactoryName] = useState("");
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [status, setStatus] = useState("");
  const [lastTx, setLastTx] = useState("");
  const [step, setStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<AgentInsight | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    document.title = "ShiftLedger — Factory payroll";
  }, []);

  useEffect(() => {
    const stored = loadRoster();
    if (stored) {
      setFactoryName(stored.factoryName || "");
      setShiftPeriod(stored.shiftPeriod || currentPayPeriod());
      setRows(stored.rows || []);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveRoster({ factoryName, shiftPeriod, rows });
  }, [factoryName, shiftPeriod, rows, hydrated]);

  useEffect(() => {
    if (address) {
      setDraft((prev) => (prev.wallet ? prev : { ...prev, wallet: address }));
    }
  }, [address]);

  const wrongNetwork = isConnected && chainId !== SEPOLIA;

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: d.contracts.mockUsdc as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const { data: receiptIds, refetch: refetchReceipts } = useReadContract({
    address: d.contracts.shiftLedger as `0x${string}`,
    abi: shiftLedgerAbi,
    functionName: "getWorkerReceipts",
    args: address ? [address] : undefined,
    query: { enabled: deployed && Boolean(address) },
  });

  const totalUsdNum = useMemo(() => {
    if (report) return report.totalUsd;
    return rows.reduce((s, r) => s + r.amountUsd, 0);
  }, [report, rows]);

  const signIn = useCallback(() => {
    const connector = connectors[0];
    if (!connector) {
      setStatus("Install a browser wallet (MetaMask or similar), then sign in.");
      return;
    }
    connect({ connector });
  }, [connect, connectors]);

  function clearReview() {
    setReport(null);
    setInsight(null);
    setStep(0);
  }

  function addWorker() {
    const name = draft.name.trim();
    const role = draft.role.trim();
    const wallet = draft.wallet.trim();
    const hours = Number(draft.hours);
    const rateUsd = Number(draft.rateUsd);

    if (!name || !role || !wallet) {
      setFormError("Add name, role, and payout account.");
      return;
    }
    if (!Number.isFinite(hours) || !Number.isFinite(rateUsd) || hours <= 0 || rateUsd <= 0) {
      setFormError("Hours and rate must be valid numbers.");
      return;
    }
    if (rows.some((r) => r.wallet.toLowerCase() === wallet.toLowerCase() && r.name === name)) {
      setFormError("That worker is already on this week’s roster.");
      return;
    }

    const amountUsd = Math.round(hours * rateUsd * 100) / 100;
    setRows((prev) => [...prev, { name, wallet, hours, rateUsd, role, amountUsd }]);
    setDraft({ ...emptyDraft, wallet: address ?? "" });
    setFormError("");
    clearReview();
    setStatus(`${name} added to this week’s roster.`);
  }

  function removeWorker(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    clearReview();
  }

  const runReview = useCallback(async () => {
    if (rows.length === 0) {
      setFormError("Add at least one worker before review.");
      return;
    }
    setFormError("");
    setAnalyzing(true);
    setInsight(null);
    setReport(null);
    await new Promise((r) => setTimeout(r, AGENT_ANALYSIS_MS));
    const agentReport = runPayrollAgent(rows);
    setReport(agentReport);
    setInsight(buildAgentInsight(rows, agentReport));
    setStep(1);
    setStatus(
      agentReport.approved
        ? "Roster approved. Sign-off and pay to create verified pay slips."
        : "Roster needs fixes before you can pay."
    );
    setAnalyzing(false);
  }, [rows]);

  async function fundPayoutAccount() {
    if (!deployed || !address) return;
    setFunding(true);
    try {
      setStatus("Adding testnet funds to your payout account…");
      const faucetHash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "faucet",
        args: [parseUnits("10000", 6)],
      });
      setLastTx(faucetHash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: faucetHash });
      await refetchBalance();
      setStep(2);
      setStatus("Funds ready. You can pay your team.");
    } catch (e) {
      setStatus(friendlyError(e));
    } finally {
      setFunding(false);
    }
  }

  async function payWorkers() {
    if (!deployed || !address || !report?.approved || rows.length === 0) return;
    setBusy(true);
    try {
      const total = parseUnits(totalUsdNum.toFixed(2), 6);
      const balance = usdcBalance ?? 0n;
      if (balance < total) {
        setStatus("Not enough payout balance. Click Add funds, then Pay team.");
        setBusy(false);
        return;
      }

      const workers = rows.map((r) => r.wallet as `0x${string}`);
      const amounts = rows.map((r) => parseUnits(r.amountUsd.toFixed(2), 6));
      const roles = rows.map((r) => r.role);

      setStatus("Sending wages…");
      setStep(2);
      const approveHash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [d.contracts.shiftLedger as `0x${string}`, total],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const settleHash = await writeContractAsync({
        address: d.contracts.shiftLedger as `0x${string}`,
        abi: shiftLedgerAbi,
        functionName: "settleBatch",
        args: [workers, amounts, roles, shiftPeriod, report.payrollHash],
      });
      setLastTx(settleHash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: settleHash });
      setStep(4);
      setStatus("Wages sent. Verified pay slips are on the ledger.");
      await refetchReceipts();
      setTab("worker");
    } catch (e) {
      setStatus(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function onPayClick() {
    if (!isConnected) {
      signIn();
      return;
    }
    if (wrongNetwork) {
      setStatus("Switch to the payout network, then try again.");
      return;
    }
    if (!report?.approved) {
      setStatus("Review and approve the roster before paying.");
      return;
    }
    void payWorkers();
  }

  function downloadCsvTemplate() {
    const blob = new Blob([csvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shiftledger-roster-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onCsvImport(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parsePayrollCsv(text);
      if (parsed.length === 0) {
        setFormError("CSV has no workers. Use the template and add rows.");
        return;
      }
      setRows(parsed);
      clearReview();
      setFormError("");
      setStatus(`Imported ${parsed.length} worker${parsed.length > 1 ? "s" : ""} from CSV.`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not read CSV");
    }
  }

  function resetWorkspace() {
    setRows([]);
    setFactoryName("");
    setShiftPeriod(currentPayPeriod());
    clearReview();
    clearRoster();
    setStatus("Workspace cleared.");
  }

  // Signed-out: real product landing — no fake employees, no fake pay slips.
  if (!isConnected) {
    return (
      <div className="app">
        <SiteBar
          isConnected={false}
          connecting={connecting}
          tab={tab}
          onTabChange={setTab}
          onConnect={signIn}
          onDisconnect={() => disconnect()}
          theme={theme}
          onToggleTheme={toggleTheme}
          showNav={false}
        />
        <main className="main landing">
          <section className="product-hero reveal">
            <div>
              <p className="eyebrow">Factory payroll</p>
              <h1>Pay shift workers on time. Give every worker proof.</h1>
              <p className="hero-copy">
                ShiftLedger helps factory HR teams review weekly rosters, pay wages in one step, and give
                workers a verified pay slip they can keep — built for industrial teams in Southeast Asia.
              </p>
              <div className="hero-actions">
                <button type="button" className="btn btn-primary" disabled={connecting} onClick={signIn}>
                  {connecting ? <Loader2 size={16} className="spin" /> : null}
                  Open payroll workspace
                  <ArrowRight size={16} className="btn-icon btn-icon-trail" />
                </button>
              </div>
              <p className="meta">Sign in with your payout account to start this week’s payroll.</p>
            </div>
            <aside className="hero-visual reveal delay-1">
              <div className="home-icon-frame">
                <img
                  className="home-icon"
                  src={theme === "dark" ? "/home-icon-dark.png" : "/home-icon.png"}
                  alt=""
                  width={280}
                  height={235}
                  draggable={false}
                />
              </div>
              <div className="hero-card">
                <h3>Weekly payroll flow</h3>
                <ol>
                  <li>
                    <span className="step-num">1</span>
                    <span>Sign in to your company payout account</span>
                  </li>
                  <li>
                    <span className="step-num">2</span>
                    <span>Add this week’s workers, hours, and rates</span>
                  </li>
                  <li>
                    <span className="step-num">3</span>
                    <span>Review overtime, rates, and payout accounts</span>
                  </li>
                  <li>
                    <span className="step-num">4</span>
                    <span>Pay once — workers get verified pay slips</span>
                  </li>
                </ol>
              </div>
            </aside>
          </section>

          <section className="platform-section reveal">
            <header className="section-head">
              <p className="eyebrow">Why it exists</p>
              <h2>Late wages and missing proof still break factory floors</h2>
              <p>
                Across Malaysia and SEA manufacturing, shift payroll is still spreadsheets, cash, and disputes.
                Workers need clarity. HR needs speed. Finance needs an audit trail.
              </p>
            </header>
            <div className="value-grid">
              <article className="value-card">
                <span className="value-icon">
                  <Factory size={18} />
                </span>
                <h3>For factory HR</h3>
                <p>Review hours and overtime before money moves. Pay the whole week in one action.</p>
              </article>
              <article className="value-card">
                <span className="value-icon">
                  <Users size={18} />
                </span>
                <h3>For shift workers</h3>
                <p>Every payout leaves a clear pay slip — role, period, amount — not a screenshot of a chat.</p>
              </article>
              <article className="value-card">
                <span className="value-icon">
                  <Bot size={18} />
                </span>
                <h3>Review + human control</h3>
                <p>The engine flags overtime and rate risks. People approve. Machines assist — they don’t replace HR.</p>
              </article>
              <article className="value-card">
                <span className="value-icon">
                  <Building2 size={18} />
                </span>
                <h3>Simple for every team</h3>
                <p>Payroll language first. Secure settlement underneath — no jargon in the day-to-day product.</p>
              </article>
            </div>
          </section>

          <section className="platform-section reveal delay-1">
            <header className="section-head">
              <p className="eyebrow">Platform</p>
              <h2>What you get in the workspace</h2>
            </header>
            <div className="platform-strip">
              <div>
                <ShieldCheck size={18} className="strip-icon" />
                <strong>Roster review</strong>
                <p>Hours, rates, overtime, payout accounts</p>
              </div>
              <div>
                <Send size={18} className="strip-icon" />
                <strong>Batch payout</strong>
                <p>One pay run for the whole shift week</p>
              </div>
              <div>
                <Receipt size={18} className="strip-icon" />
                <strong>Verified slips</strong>
                <p>Worker-owned proof after payment</p>
              </div>
            </div>
          </section>

          <section className="cta-band reveal">
            <div>
              <h2>Ready to run this week’s payroll?</h2>
              <p>Open the workspace, add your team, review, and pay.</p>
            </div>
            <button type="button" className="btn btn-primary" disabled={connecting} onClick={signIn}>
              Sign in to ShiftLedger
              <ArrowRight size={16} className="btn-icon btn-icon-trail" />
            </button>
          </section>

          {status && (
            <footer className="status-bar">
              <span>{status}</span>
            </footer>
          )}
          <SiteFooter />
        </main>
      </div>
    );
  }

  const needsFunds =
    report?.approved &&
    usdcBalance !== undefined &&
    usdcBalance < parseUnits(totalUsdNum.toFixed(2), 6);

  return (
    <div className="app">
      <SiteBar
        isConnected={isConnected}
        connecting={connecting}
        address={address}
        tab={tab}
        onTabChange={setTab}
        onConnect={signIn}
        onDisconnect={() => disconnect()}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="main">
        {wrongNetwork && (
          <div className="banner error">Switch to the payout network to send wages.</div>
        )}

        {tab === "employer" && (
          <div key="employer" className="view-panel">
            <header className="page-head">
              <h1>Payroll workspace</h1>
              <p>
                {factoryName.trim() || "Your company"} · {shiftPeriod} · Review before payout
              </p>
            </header>

            <div className="toolbar">
              <div>
                <strong>This week’s wages</strong>
                <p className="muted">
                  {rows.length === 0
                    ? "Add your workers, then review and pay."
                    : `${rows.length} worker${rows.length > 1 ? "s" : ""} on roster · ${formatPay(totalUsdNum)}`}
                </p>
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={fundPayoutAccount}
                  disabled={funding || busy || !deployed || wrongNetwork}
                >
                  {funding ? <Loader2 size={16} className="spin" /> : <Wallet size={16} className="btn-icon" />}
                  Add funds
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onPayClick}
                  disabled={busy || !report?.approved || !deployed || wrongNetwork || needsFunds}
                >
                  {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} className="btn-icon" />}
                  Pay team
                </button>
              </div>
            </div>
            {needsFunds && (
              <div className="banner info">Add testnet funds before paying this week’s total.</div>
            )}

            <ol className="steps">
              <li className={rows.length > 0 ? "done" : ""}>Add team</li>
              <li className={step >= 1 ? "done" : ""}>Review</li>
              <li className={step >= 2 ? "done" : ""}>Pay</li>
              <li className={step >= 4 || receiptIds?.length ? "done" : ""}>Pay slips</li>
            </ol>

            <div className="grid grid-2">
              <section className="card reveal">
                <h2>Your roster</h2>
                <div className="field">
                  <label htmlFor="factory">Company</label>
                  <input
                    id="factory"
                    type="text"
                    value={factoryName}
                    onChange={(e) => setFactoryName(e.target.value)}
                    placeholder="e.g. your factory name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="shift">Pay period</label>
                  <input
                    id="shift"
                    type="text"
                    value={shiftPeriod}
                    onChange={(e) => setShiftPeriod(e.target.value)}
                  />
                </div>

                <div className="add-worker">
                  <p className="add-worker-title">Add a worker</p>
                  <div className="field-grid">
                    <div className="field">
                      <label htmlFor="w-name">Name</label>
                      <input
                        id="w-name"
                        value={draft.name}
                        onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Worker full name"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="w-role">Role</label>
                      <input
                        id="w-role"
                        value={draft.role}
                        onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))}
                        placeholder="e.g. Line operator"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="w-hours">Hours</label>
                      <input
                        id="w-hours"
                        type="number"
                        min="1"
                        step="1"
                        value={draft.hours}
                        onChange={(e) => setDraft((p) => ({ ...p, hours: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="w-rate">Rate (USD/hr)</label>
                      <input
                        id="w-rate"
                        type="number"
                        min="0.01"
                        step="0.25"
                        value={draft.rateUsd}
                        onChange={(e) => setDraft((p) => ({ ...p, rateUsd: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="w-account">Payout account</label>
                    <input
                      id="w-account"
                      value={draft.wallet}
                      onChange={(e) => setDraft((p) => ({ ...p, wallet: e.target.value }))}
                      placeholder="0x… worker payout account"
                      spellCheck={false}
                    />
                    <p className="meta">
                      Defaults to your signed-in account so you can receive a verified slip. Change it for
                      each real worker.
                    </p>
                  </div>
                  {formError && <div className="banner error">{formError}</div>}
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={addWorker}>
                      <Plus size={16} className="btn-icon" />
                      Add worker
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={runReview}
                      disabled={rows.length === 0 || analyzing}
                    >
                      {analyzing ? (
                        <Loader2 size={16} className="spin" />
                      ) : (
                        <ShieldCheck size={16} className="btn-icon" />
                      )}
                      {analyzing ? "Reviewing…" : "Review roster"}
                    </button>
                  </div>
                  <div className="row-actions import-actions">
                    <label className="btn file-btn">
                      <Upload size={16} className="btn-icon" />
                      Import CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={(e) => {
                          void onCsvImport(e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button type="button" className="btn btn-ghost" onClick={downloadCsvTemplate}>
                      <Download size={16} className="btn-icon" />
                      CSV template
                    </button>
                    {rows.length > 0 && (
                      <button type="button" className="btn btn-ghost" onClick={resetWorkspace}>
                        Clear roster
                      </button>
                    )}
                  </div>
                </div>

                {rows.length === 0 ? (
                  <p className="empty-hint">
                    No workers yet. Add people manually or import a CSV roster for this week.
                  </p>
                ) : (
                  <ul className="worker-list">
                    {rows.map((r, i) => (
                      <li key={`${r.name}-${r.wallet}-${i}`} className="worker-item">
                        <div>
                          <strong>{r.name}</strong>
                          <span className="muted">
                            {r.role} · {r.hours}h · {formatUsd(r.amountUsd)}
                          </span>
                          <span className="mono-line">{shortAddr(r.wallet)}</span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost icon-btn"
                          aria-label={`Remove ${r.name}`}
                          onClick={() => removeWorker(i)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card reveal delay-1">
                <h2>
                  <ShieldCheck size={14} className="heading-icon" /> Review
                </h2>
                {!report && !analyzing ? (
                  <p className="muted">Add your team, then review hours, rates, and payout accounts.</p>
                ) : analyzing ? (
                  <div className="agent-analyzing">
                    <Loader2 size={20} className="spin" />
                    <div>
                      <strong>Checking your roster…</strong>
                      <p className="muted">Hours, rates, overtime, payout accounts</p>
                    </div>
                  </div>
                ) : report ? (
                  <>
                    <div className="agent-score">
                      <div
                        className={`score-ring ${report.approved ? (report.issues.some((i) => i.severity === "warning") ? "warn" : "ok") : "bad"}`}
                      >
                        {report.score}
                      </div>
                      <div>
                        <strong>{report.approved ? "Ready to pay" : "Needs fixes"}</strong>
                        <p className="muted">{report.summary}</p>
                      </div>
                    </div>
                    {report.issues.length > 0 && (
                      <div className="issue-list">
                        {report.issues.map((issue, i) => (
                          <div key={i} className={`issue ${issue.severity}`}>
                            {issue.message}
                          </div>
                        ))}
                      </div>
                    )}
                    {insight && (
                      <ol className="agent-steps">
                        {insight.steps.map((s) => (
                          <li key={s.id} className={s.status}>
                            <span className="step-label">{s.label}</span>
                            <span className="muted">{s.detail}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {insight && (
                      <div className="agent-rec">
                        <ShieldCheck size={14} />
                        <p>{insight.recommendation}</p>
                      </div>
                    )}
                    <ul className="policy-list">
                      {report.policyChecks.map((c) => (
                        <li key={c.id} className={c.passed ? "pass" : "fail"}>
                          <span>{c.label}</span>
                          <span className="muted">{c.detail}</span>
                        </li>
                      ))}
                    </ul>
                    {rows.length > 0 && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Worker</th>
                              <th>Hours</th>
                              <th>Pay</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={`${r.name}-${r.wallet}`}>
                                <td>
                                  {r.name}
                                  <div className="muted">{r.role}</div>
                                </td>
                                <td>{r.hours}</td>
                                <td>
                                  <span className="pay-stack">
                                    <strong>{formatUsd(r.amountUsd)}</strong>
                                    <span className="muted">{formatMyr(r.amountUsd)}</span>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="total-line">
                          <span>Week total</span>
                          <strong>{formatPay(totalUsdNum)}</strong>
                        </p>
                      </div>
                    )}
                  </>
                ) : null}

                {usdcBalance !== undefined && (
                  <p className="meta">Payout balance: {formatUnits(usdcBalance, 6)} USD</p>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === "worker" && (
          <div key="worker" className="view-panel">
            <header className="page-head">
              <h1>Pay slips</h1>
              <p>Only verified payouts for your signed-in account.</p>
            </header>

            <section className="card reveal">
              {!receiptIds?.length ? (
                <div className="empty-state">
                  <div className="empty-icon" aria-hidden="true">
                    <Receipt size={22} />
                  </div>
                  <p>
                    <strong>No verified pay slips yet</strong>
                  </p>
                  <p className="muted">
                    Pay a roster that includes your payout account. Draft names never show here — only real
                    payments do.
                  </p>
                </div>
              ) : (
                <>
                  <p className="receipt-count">
                    {receiptIds.length} verified pay slip{receiptIds.length > 1 ? "s" : ""}
                  </p>
                  {receiptIds.map((id, index) => (
                    <ReceiptCard
                      key={id}
                      receiptId={id as Hex}
                      ledger={d.contracts.shiftLedger}
                      factory={factoryName.trim() || "Employer"}
                      index={index}
                    />
                  ))}
                </>
              )}
            </section>
          </div>
        )}

        {(status || lastTx) && (
          <div className="status-bar">
            {status && <span>{status}</span>}
            {lastTx && (
              <a href={explorerTx(lastTx)} target="_blank" rel="noreferrer">
                Payment record {shortAddr(lastTx)} <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}

        <SiteFooter ledgerAddress={d.contracts.shiftLedger} deployed={deployed} />
      </main>
    </div>
  );
}

function ReceiptCard({
  receiptId,
  ledger,
  factory,
  index = 0,
}: {
  receiptId: Hex;
  ledger: string;
  factory: string;
  index?: number;
}) {
  const { data } = useReadContract({
    address: ledger as `0x${string}`,
    abi: shiftLedgerAbi,
    functionName: "receipts",
    args: [receiptId],
  });

  if (!data) return null;

  const [, , , , amount, shiftPeriod, role, paidAt] = data;
  const paidDate = new Date(Number(paidAt) * 1000).toLocaleDateString();
  const usd = Number(formatUnits(amount as bigint, 6));

  return (
    <article className="receipt reveal" style={{ animationDelay: `${0.05 + index * 0.06}s` }}>
      <div className="receipt-head">
        <div>
          <div className="receipt-verified">
            <CheckCircle2 size={14} className="verified-icon" />
            Verified
          </div>
          <strong>{role as string}</strong>
          <span className="muted">
            {factory} · {shiftPeriod as string}
          </span>
        </div>
        <span className="receipt-amount">
          {formatUsd(usd)}
          <small>{formatMyr(usd)}</small>
        </span>
      </div>
      <p className="meta">Paid {paidDate}</p>
      <a className="receipt-link" href={explorerAddr(ledger)} target="_blank" rel="noreferrer">
        Open proof <ExternalLink size={12} className="btn-icon-trail" />
      </a>
    </article>
  );
}
