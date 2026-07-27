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
import { Bot, CheckCircle2, Coins, ExternalLink, Loader2, Play, ShieldCheck } from "lucide-react";
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

type Tab = "employer" | "worker";
const SEPOLIA = 11155111;

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
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [lastTx, setLastTx] = useState("");

  const [demoStep, setDemoStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<AgentInsight | null>(null);

  useEffect(() => {
    document.title = "ShiftLedger";
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
    if (!address) return;
    const demo = demoCsv(address);
    setCsv(demo);
    setParseError("");
    setAnalyzing(true);
    setInsight(null);
    setReport(null);
    await new Promise((r) => setTimeout(r, AGENT_ANALYSIS_MS));
    const parsed = parsePayrollCsv(demo);
    const agentReport = runPayrollAgent(parsed);
    applyAgentReport(parsed, agentReport);
    setDemoStep(1);
    setStatus("Sample loaded · agent analysis complete.");
    setAnalyzing(false);
  }, [address, applyAgentReport]);

  async function runQuickStart() {
    if (!address || !deployed) return;
    setBusy(true);
    try {
      await loadAndValidate();

      setStatus("Minting sUSD…");
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
        setStatus("Validation blocked — fix roster first.");
        return;
      }

      const total = parseUnits(agentReport.totalUsd.toFixed(2), 6);
      const workers = parsed.map((r) => r.wallet as `0x${string}`);
      const amounts = parsed.map((r) => parseUnits(r.amountUsd.toFixed(2), 6));
      const roles = parsed.map((r) => r.role);

      setStatus("Settling on-chain…");
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
      setStatus("Payroll settled — on-chain receipt ready.");
      await refetchReceipts();
      setTab("worker");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Payroll flow failed");
    } finally {
      setBusy(false);
    }
  }

  const totalDisplay = useMemo(() => {
    if (report) return report.totalUsd.toFixed(2);
    return rows.reduce((s, r) => s + r.amountUsd, 0).toFixed(2);
  }, [report, rows]);

  async function faucet() {
    if (!deployed || !address) return;
    setBusy(true);
    setStatus("Minting sUSD…");
    try {
      const hash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "faucet",
        args: [parseUnits("10000", 6)],
      });
      setLastTx(hash);
      setStatus("10,000 sUSD added.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Faucet failed");
    } finally {
      setBusy(false);
    }
  }

  async function settleBatch() {
    if (!deployed || !address || !report?.approved || rows.length === 0) return;
    setBusy(true);
    setStatus("Approving…");
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

      setStatus("Settling batch…");
      const hash = await writeContractAsync({
        address: d.contracts.shiftLedger as `0x${string}`,
        abi: shiftLedgerAbi,
        functionName: "settleBatch",
        args: [workers, amounts, roles, shiftPeriod, report.payrollHash],
      });
      setLastTx(hash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`Paid ${rows.length} workers.`);
      refetchReceipts();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Settlement failed");
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
        {wrongNetwork && (
          <div className="banner error">Switch to Ethereum Sepolia.</div>
        )}

        {!isConnected && (
          <div className="banner info">
            Connect an <strong>Ethereum Sepolia</strong> wallet, then click <strong>Run payroll flow</strong>.
          </div>
        )}

        {tab === "employer" && (
          <>
            <header className="page-head">
              <div>
                <h1>Batch payroll</h1>
                <p>Industrial shift wages — AI-validated, stablecoin-settled, receipt-verified.</p>
              </div>
            </header>

            <div className="demo-bar">
              <div>
                <strong>Quick start</strong>
                <p className="muted">Load → Validate → Settle → Receipts</p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={runQuickStart}
                disabled={busy || !address || !deployed || wrongNetwork}
              >
                {busy ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                Run payroll flow
              </button>
            </div>

            <ol className="demo-steps">
              <li className={demoStep >= 1 ? "done" : ""}>Validate roster</li>
              <li className={demoStep >= 2 ? "done" : ""}>Fund sUSD</li>
              <li className={demoStep >= 3 ? "done" : ""}>Settle batch</li>
              <li className={demoStep >= 4 || receiptIds?.length ? "done" : ""}>Worker receipts</li>
            </ol>

            <div className="grid grid-2">
              <section className="card">
                <h2>Roster</h2>
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
                  <label htmlFor="shift">Shift period</label>
                  <input
                    id="shift"
                    type="text"
                    value={shiftPeriod}
                    onChange={(e) => setShiftPeriod(e.target.value)}
                  />
                </div>
                <div className="row-actions">
                  <button type="button" className="btn" onClick={loadAndValidate} disabled={!address || analyzing}>
                    Load sample
                  </button>
                  <button type="button" className="btn btn-primary" onClick={runAgent} disabled={!csv.trim() || analyzing}>
                    <Bot size={16} />
                    {analyzing ? "Analyzing…" : "Validate"}
                  </button>
                </div>
              </section>

              <section className="card">
                <h2>
                  <ShieldCheck size={14} /> Payroll Intelligence Agent
                </h2>
                {!report && !analyzing ? (
                  <p className="muted">Run validation to review payroll before settlement.</p>
                ) : analyzing ? (
                  <div className="agent-analyzing">
                    <Loader2 size={20} className="spin" />
                    <div>
                      <strong>Agent analyzing roster…</strong>
                      <p className="muted">Policy scan · wallet check · compliance rules</p>
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
                        <strong>{report.approved ? "Ready to settle" : "Blocked"}</strong>
                        <p className="muted">{report.summary}</p>
                        {insight && (
                          <p className="meta">Confidence {insight.confidence}% · {new Date(report.analyzedAt).toLocaleTimeString()}</p>
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
                        <Bot size={14} />
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
                            <td>${r.amountUsd.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="total-line">
                      Total <strong>${totalDisplay}</strong> sUSD
                    </p>
                  </div>
                )}

                <div className="row-actions">
                  <button type="button" className="btn" onClick={faucet} disabled={busy || !deployed || !address}>
                    <Coins size={16} />
                    Get sUSD
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={settleBatch}
                    disabled={busy || !report?.approved || !deployed || wrongNetwork}
                  >
                    {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                    Settle
                  </button>
                </div>
                {usdcBalance !== undefined && (
                  <p className="meta">Balance: {formatUnits(usdcBalance, 6)} sUSD</p>
                )}
              </section>
            </div>
          </>
        )}

        {tab === "worker" && (
          <>
            <header className="page-head">
              <div>
                <h1>Receipts</h1>
                <p>Immutable wage receipts — verified on Ethereum Sepolia.</p>
              </div>
            </header>

            <section className="card">
              {!address ? (
                <p className="muted">Connect your wallet to view receipts.</p>
              ) : !receiptIds?.length ? (
                <p className="muted">No payments yet. Run payroll to generate a receipt.</p>
              ) : (
                <>
                  <p className="receipt-count">{receiptIds.length} on-chain receipt{receiptIds.length > 1 ? "s" : ""}</p>
                  {receiptIds.map((id) => (
                    <ReceiptCard key={id} receiptId={id as Hex} ledger={d.contracts.shiftLedger} />
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
                {shortAddr(lastTx)} <ExternalLink size={12} />
              </a>
            )}
          </footer>
        )}

        {deployed && (
          <div className="footer-links">
            <a href={explorerAddr(d.contracts.shiftLedger)} target="_blank" rel="noreferrer">
              Contract
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

function ReceiptCard({ receiptId, ledger }: { receiptId: Hex; ledger: string }) {
  const { data } = useReadContract({
    address: ledger as `0x${string}`,
    abi: shiftLedgerAbi,
    functionName: "receipts",
    args: [receiptId],
  });

  if (!data) return null;

  const [, , employer, , amount, shiftPeriod, role, paidAt] = data;
  const paidDate = new Date(Number(paidAt) * 1000).toLocaleDateString();

  return (
    <article className="receipt">
      <div className="receipt-head">
        <div>
          <div className="receipt-verified">
            <CheckCircle2 size={14} />
            On-chain verified
          </div>
          <strong>{role as string}</strong>
          <span className="muted">Shift {shiftPeriod as string}</span>
        </div>
        <span className="receipt-amount">${formatUnits(amount as bigint, 6)}</span>
      </div>
      <p className="meta">
        Paid {paidDate} · Employer {shortAddr(employer as string)}
      </p>
      <a className="receipt-link" href={explorerAddr(ledger)} target="_blank" rel="noreferrer">
        View contract <ExternalLink size={12} />
      </a>
    </article>
  );
}
