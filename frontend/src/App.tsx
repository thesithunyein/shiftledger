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
import { CheckCircle2, Coins, ExternalLink, Loader2, Play, ShieldCheck } from "lucide-react";
import { SiteBar } from "./components/SiteBar";
import { erc20Abi, shiftLedgerAbi } from "./lib/abis";
import { explorerAddr, explorerTx, getDeployment, isDeployed, shortAddr } from "./lib/deployment";
import {
  demoCsv,
  parsePayrollCsv,
  runPayrollAgent,
  type AgentReport,
  type PayrollRow,
} from "./lib/payrollAgent";
import { AGENT_ANALYSIS_MS, buildAgentInsight, type AgentInsight } from "./lib/agentInsight";
import { formatMyr, formatPay, formatUsd } from "./lib/money";

type Tab = "employer" | "worker";
const SEPOLIA = 11155111;
const FACTORY = "KL Precision Parts Sdn Bhd";

export function App() {
  const d = getDeployment();
  const deployed = isDeployed(d);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tab, setTab] = useState<Tab>("employer");
  const [csv, setCsv] = useState("");
  const [shiftPeriod, setShiftPeriod] = useState("2026-W30");
  const [factoryName, setFactoryName] = useState(FACTORY);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [lastTx, setLastTx] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const [demoStep, setDemoStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<AgentInsight | null>(null);

  useEffect(() => {
    document.title = "ShiftLedger — Factory payroll";
  }, []);

  const wrongNetwork = isConnected && chainId !== SEPOLIA;

  const { data: usdcBalance } = useReadContract({
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

  const applyAgentReport = useCallback((parsed: PayrollRow[], agentReport: AgentReport) => {
    setRows(parsed);
    setReport(agentReport);
    setInsight(buildAgentInsight(parsed, agentReport));
  }, []);

  const runAgent = useCallback(async () => {
    try {
      const parsed = parsePayrollCsv(csv);
      setParseError("");
      setAnalyzing(true);
      setInsight(null);
      setReport(null);
      await new Promise((r) => setTimeout(r, AGENT_ANALYSIS_MS));
      const agentReport = runPayrollAgent(parsed);
      applyAgentReport(parsed, agentReport);
      setDemoStep(1);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Invalid CSV");
      setReport(null);
      setInsight(null);
      setRows([]);
    } finally {
      setAnalyzing(false);
    }
  }, [applyAgentReport, csv]);

  const loadAndValidate = useCallback(async () => {
    const viewer = address ?? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const demo = demoCsv(viewer);
    setCsv(demo);
    setParseError("");
    setPreviewMode(!address);
    setAnalyzing(true);
    setInsight(null);
    setReport(null);
    await new Promise((r) => setTimeout(r, AGENT_ANALYSIS_MS));
    const parsed = parsePayrollCsv(demo);
    const agentReport = runPayrollAgent(parsed);
    applyAgentReport(parsed, agentReport);
    setDemoStep(1);
    setStatus(
      address
        ? "Sample roster loaded · payroll review complete."
        : "Preview ready · no wallet needed. Sign in only when you want to pay for real."
    );
    setAnalyzing(false);
  }, [address, applyAgentReport]);

  async function runQuickStart() {
    if (!address || !deployed) return;
    setBusy(true);
    setPreviewMode(false);
    try {
      await loadAndValidate();

      setStatus("Adding payroll funds…");
      const faucetHash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "faucet",
        args: [parseUnits("10000", 6)],
      });
      setLastTx(faucetHash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: faucetHash });
      setDemoStep(2);

      const demo = demoCsv(address);
      const parsed = parsePayrollCsv(demo);
      const agentReport = runPayrollAgent(parsed);
      applyAgentReport(parsed, agentReport);
      if (!agentReport.approved) {
        setStatus("Payment blocked — fix roster first.");
        return;
      }

      const total = parseUnits(agentReport.totalUsd.toFixed(2), 6);
      const workers = parsed.map((r) => r.wallet as `0x${string}`);
      const amounts = parsed.map((r) => parseUnits(r.amountUsd.toFixed(2), 6));
      const roles = parsed.map((r) => r.role);

      setStatus("Paying workers…");
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
        args: [workers, amounts, roles, shiftPeriod, agentReport.payrollHash],
      });
      setLastTx(settleHash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: settleHash });
      setDemoStep(4);
      setStatus("Workers paid · pay slips ready.");
      await refetchReceipts();
      setTab("worker");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Payroll failed");
    } finally {
      setBusy(false);
    }
  }

  const totalDisplay = useMemo(() => {
    if (report) return report.totalUsd.toFixed(2);
    return rows.reduce((s, r) => s + r.amountUsd, 0).toFixed(2);
  }, [report, rows]);

  const totalUsdNum = Number(totalDisplay) || 0;

  async function faucet() {
    if (!deployed || !address) return;
    setBusy(true);
    setStatus("Adding payroll funds…");
    try {
      const hash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "faucet",
        args: [parseUnits("10000", 6)],
      });
      setLastTx(hash);
      setStatus("Payroll funds added.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not add funds");
    } finally {
      setBusy(false);
    }
  }

  async function settleBatch() {
    if (!deployed || !address || !report?.approved || rows.length === 0) return;
    setBusy(true);
    setPreviewMode(false);
    setStatus("Approving payment…");
    try {
      const total = parseUnits(totalDisplay, 6);
      const workers = rows.map((r) => r.wallet as `0x${string}`);
      const amounts = rows.map((r) => parseUnits(r.amountUsd.toFixed(2), 6));
      const roles = rows.map((r) => r.role);

      const approveHash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [d.contracts.shiftLedger as `0x${string}`, total],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setStatus("Paying workers…");
      const hash = await writeContractAsync({
        address: d.contracts.shiftLedger as `0x${string}`,
        abi: shiftLedgerAbi,
        functionName: "settleBatch",
        args: [workers, amounts, roles, shiftPeriod, report.payrollHash],
      });
      setLastTx(hash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`Paid ${rows.length} workers.`);
      setDemoStep(4);
      refetchReceipts();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <SiteBar
        isConnected={isConnected}
        connecting={connecting}
        address={address}
        tab={tab}
        onTabChange={setTab}
        onConnect={() => connect({ connector: connectors[0] })}
        onDisconnect={() => disconnect()}
      />

      <main className="main">
        {!isConnected && (
          <section className="product-hero">
            <p className="eyebrow">For factories · Malaysia &amp; SEA</p>
            <h1>Pay shift workers on time. Give them proof.</h1>
            <p>
              Built for HR clerks and factory workers who do not live in crypto. Upload a roster, review
              overtime flags, pay the week in one click, and let every worker keep a verified pay slip.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={loadAndValidate} disabled={analyzing}>
                {analyzing ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                Preview without wallet
              </button>
              <button type="button" className="btn" onClick={() => connect({ connector: connectors[0] })}>
                Sign in to pay (demo network)
              </button>
            </div>
            <ul className="hero-points">
              <li>HR sees dollars and ringgit</li>
              <li>Workers get a pay slip, not a blockchain lecture</li>
              <li>Optional wallet only when you settle for real</li>
            </ul>
          </section>
        )}

        {wrongNetwork && (
          <div className="banner error">Switch your wallet network to Ethereum Sepolia (demo network).</div>
        )}

        {isConnected && (
          <div className="banner info">
            Signed in on the <strong>demo network</strong>. Click <strong>Pay this week</strong> to run the full factory flow.
          </div>
        )}

        {previewMode && !isConnected && report && (
          <div className="banner info">
            You are in <strong>preview mode</strong> — no wallet, no gas. Sign in only if you want a live payment.
          </div>
        )}

        {tab === "employer" && (
          <>
            <header className="page-head">
              <div>
                <h1>Weekly payroll</h1>
                <p>
                  {factoryName} · review roster, pay the shift week, issue worker pay slips.
                </p>
              </div>
            </header>

            <div className="demo-bar">
              <div>
                <strong>{isConnected ? "Pay this week" : "Try the HR flow"}</strong>
                <p className="muted">
                  {isConnected
                    ? "Load roster → review flags → pay workers → open pay slips"
                    : "Preview works without crypto. Sign in only to settle live."}
                </p>
              </div>
              {isConnected ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={runQuickStart}
                  disabled={busy || !deployed || wrongNetwork}
                >
                  {busy ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                  Pay this week
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={loadAndValidate} disabled={analyzing}>
                  {analyzing ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                  Preview roster
                </button>
              )}
            </div>

            <ol className="demo-steps">
              <li className={demoStep >= 1 ? "done" : ""}>Review roster</li>
              <li className={demoStep >= 2 ? "done" : ""}>Fund payroll</li>
              <li className={demoStep >= 3 || demoStep >= 4 ? "done" : ""}>Pay workers</li>
              <li className={demoStep >= 4 || receiptIds?.length ? "done" : ""}>Worker pay slips</li>
            </ol>

            <div className="grid grid-2">
              <section className="card">
                <h2>Shift roster</h2>
                <div className="field">
                  <label htmlFor="factory">Factory / company</label>
                  <input
                    id="factory"
                    type="text"
                    value={factoryName}
                    onChange={(e) => setFactoryName(e.target.value)}
                  />
                </div>
                <textarea
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    setReport(null);
                    setInsight(null);
                    setParseError("");
                  }}
                  placeholder="name,wallet,hours,rate_usd,role"
                  spellCheck={false}
                />
                {parseError && <div className="banner error">{parseError}</div>}
                <div className="field">
                  <label htmlFor="shift">Shift week</label>
                  <input
                    id="shift"
                    type="text"
                    value={shiftPeriod}
                    onChange={(e) => setShiftPeriod(e.target.value)}
                  />
                </div>
                <div className="row-actions">
                  <button type="button" className="btn" onClick={loadAndValidate} disabled={analyzing}>
                    Load sample factory
                  </button>
                  <button type="button" className="btn btn-primary" onClick={runAgent} disabled={!csv.trim() || analyzing}>
                    <ShieldCheck size={16} />
                    {analyzing ? "Reviewing…" : "Review payroll"}
                  </button>
                </div>
              </section>

              <section className="card">
                <h2>
                  <ShieldCheck size={14} /> Payroll review
                </h2>
                {!report && !analyzing ? (
                  <p className="muted">Load a roster to check hours, rates, and payout accounts before paying.</p>
                ) : analyzing ? (
                  <div className="agent-analyzing">
                    <Loader2 size={20} className="spin" />
                    <div>
                      <strong>Checking roster…</strong>
                      <p className="muted">Hours · rates · payout accounts · overtime</p>
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
                        <strong>{report.approved ? "Ready to pay" : "Blocked"}</strong>
                        <p className="muted">{report.summary}</p>
                        {insight && (
                          <p className="meta">
                            Confidence {insight.confidence}% · {new Date(report.analyzedAt).toLocaleTimeString()}
                          </p>
                        )}
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
                        {insight.steps.map((step) => (
                          <li key={step.id} className={step.status}>
                            <span className="step-label">{step.label}</span>
                            <span className="muted">{step.detail}</span>
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
                  </>
                ) : null}

                {rows.length > 0 && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Worker</th>
                          <th>Role</th>
                          <th>Hrs</th>
                          <th>Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={`${r.name}-${r.role}`}>
                            <td>{r.name}</td>
                            <td>{r.role}</td>
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
                      Week total <strong>{formatPay(totalUsdNum)}</strong>
                    </p>
                    <p className="meta">Stablecoin settlement in demo · ringgit shown for local HR context</p>
                  </div>
                )}

                <div className="row-actions">
                  <button type="button" className="btn" onClick={faucet} disabled={busy || !deployed || !address}>
                    <Coins size={16} />
                    Add funds
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={settleBatch}
                    disabled={busy || !report?.approved || !deployed || wrongNetwork || !address}
                  >
                    {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                    Pay workers
                  </button>
                </div>
                {!address && report?.approved && (
                  <p className="meta">Preview only. Sign in to pay this week on the demo network.</p>
                )}
                {usdcBalance !== undefined && (
                  <p className="meta">Payroll balance: {formatUnits(usdcBalance, 6)} sUSD</p>
                )}
              </section>
            </div>
          </>
        )}

        {tab === "worker" && (
          <>
            <header className="page-head">
              <div>
                <h1>My pay slips</h1>
                <p>Proof of wages for your shift week — shareable with family, bank, or auditor.</p>
              </div>
            </header>

            <section className="card">
              {previewMode && rows.length > 0 && !receiptIds?.length ? (
                <>
                  <p className="receipt-count">Preview pay slips · {factoryName}</p>
                  {rows.map((r) => (
                    <article key={`${r.name}-${r.role}`} className="receipt">
                      <div className="receipt-head">
                        <div>
                          <div className="receipt-verified preview">
                            <CheckCircle2 size={14} />
                            Preview slip
                          </div>
                          <strong>{r.name}</strong>
                          <span className="muted">
                            {r.role} · Shift {shiftPeriod}
                          </span>
                        </div>
                        <span className="receipt-amount">
                          {formatUsd(r.amountUsd)}
                          <small>{formatMyr(r.amountUsd)}</small>
                        </span>
                      </div>
                      <p className="meta">
                        {r.hours}h · {factoryName}
                      </p>
                    </article>
                  ))}
                  <p className="muted">
                    After HR pays for real, each worker gets a verified slip they can open without understanding crypto.
                  </p>
                </>
              ) : !address ? (
                <p className="muted">
                  Preview a roster on the HR tab first, or sign in to see verified pay slips from a live payment.
                </p>
              ) : !receiptIds?.length ? (
                <p className="muted">No pay slips yet. Ask HR to run Pay this week.</p>
              ) : (
                <>
                  <p className="receipt-count">
                    {receiptIds.length} verified pay slip{receiptIds.length > 1 ? "s" : ""}
                  </p>
                  {receiptIds.map((id) => (
                    <ReceiptCard key={id} receiptId={id as Hex} ledger={d.contracts.shiftLedger} factory={factoryName} />
                  ))}
                </>
              )}
            </section>
          </>
        )}

        {(status || lastTx) && (
          <footer className="status-bar">
            {status && <span>{status}</span>}
            {lastTx && (
              <a href={explorerTx(lastTx)} target="_blank" rel="noreferrer">
                Payment proof {shortAddr(lastTx)} <ExternalLink size={12} />
              </a>
            )}
          </footer>
        )}

        {deployed && (
          <div className="footer-links">
            <a href={explorerAddr(d.contracts.shiftLedger)} target="_blank" rel="noreferrer">
              Payment ledger
            </a>
            <a href="https://github.com/thesithunyein/shiftledger" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

function ReceiptCard({
  receiptId,
  ledger,
  factory,
}: {
  receiptId: Hex;
  ledger: string;
  factory: string;
}) {
  const { data } = useReadContract({
    address: ledger as `0x${string}`,
    abi: shiftLedgerAbi,
    functionName: "receipts",
    args: [receiptId],
  });

  if (!data) return null;

  const [, , employer, , amount, shiftPeriod, role, paidAt] = data;
  const paidDate = new Date(Number(paidAt) * 1000).toLocaleDateString();
  const usd = Number(formatUnits(amount as bigint, 6));

  return (
    <article className="receipt">
      <div className="receipt-head">
        <div>
          <div className="receipt-verified">
            <CheckCircle2 size={14} />
            Verified pay slip
          </div>
          <strong>{role as string}</strong>
          <span className="muted">
            {factory} · Shift {shiftPeriod as string}
          </span>
        </div>
        <span className="receipt-amount">
          {formatUsd(usd)}
          <small>{formatMyr(usd)}</small>
        </span>
      </div>
      <p className="meta">
        Paid {paidDate} · Employer {shortAddr(employer as string)}
      </p>
      <a className="receipt-link" href={explorerAddr(ledger)} target="_blank" rel="noreferrer">
        Open proof <ExternalLink size={12} />
      </a>
    </article>
  );
}
