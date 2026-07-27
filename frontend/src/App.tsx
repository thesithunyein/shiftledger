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
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Receipt,
  Wallet,
  Coins,
} from "lucide-react";
import { erc20Abi, shiftLedgerAbi } from "./lib/abis";
import {
  explorerAddr,
  explorerTx,
  getDeployment,
  isDeployed,
  shortAddr,
} from "./lib/deployment";
import {
  demoCsv,
  parsePayrollCsv,
  runPayrollAgent,
  type AgentReport,
  type PayrollRow,
} from "./lib/payrollAgent";

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
  const [status, setStatus] = useState("Connect wallet on Sepolia to begin.");
  const [lastTx, setLastTx] = useState("");

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

  const loadDemo = useCallback(() => {
    setCsv(demoCsv(address));
    setParseError("");
    setReport(null);
    setRows([]);
  }, [address]);

  const runAgent = useCallback(() => {
    try {
      const parsed = parsePayrollCsv(csv);
      setRows(parsed);
      setParseError("");
      setReport(runPayrollAgent(parsed));
      setStatus(`Agent analyzed ${parsed.length} workers.`);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Parse failed");
      setReport(null);
      setRows([]);
    }
  }, [csv]);

  const quickDemo = useCallback(() => {
    if (!address) return;
    const demo = demoCsv(address);
    setCsv(demo);
    setParseError("");
    try {
      const parsed = parsePayrollCsv(demo);
      setRows(parsed);
      setReport(runPayrollAgent(parsed));
      setStatus("Demo loaded — agent flagged overtime row. Faucet sUSD, then settle.");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Demo failed");
    }
  }, [address]);

  const totalDisplay = useMemo(() => {
    if (report) return report.totalUsd.toFixed(2);
    return rows.reduce((s, r) => s + r.amountUsd, 0).toFixed(2);
  }, [report, rows]);

  async function faucet() {
    if (!deployed || !address) return;
    setBusy(true);
    setStatus("Minting demo sUSD…");
    try {
      const hash = await writeContractAsync({
        address: d.contracts.mockUsdc as `0x${string}`,
        abi: erc20Abi,
        functionName: "faucet",
        args: [parseUnits("10000", 6)],
      });
      setLastTx(hash);
      setStatus("Minted 10,000 sUSD for payroll demo.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Faucet failed");
    } finally {
      setBusy(false);
    }
  }

  async function settleBatch() {
    if (!deployed || !address || !report?.approved || rows.length === 0) return;
    setBusy(true);
    setStatus("Approving ShiftLedger…");
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

      setStatus("Settling shift batch on-chain…");
      const hash = await writeContractAsync({
        address: d.contracts.shiftLedger as `0x${string}`,
        abi: shiftLedgerAbi,
        functionName: "settleBatch",
        args: [workers, amounts, roles, shiftPeriod, report.payrollHash],
      });
      setLastTx(hash);
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`Batch settled. ${rows.length} workers paid. Switch to Worker tab for receipts.`);
      refetchReceipts();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Settlement failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">SL</div>
          <div>
            <h1>ShiftLedger</h1>
            <p>AI-validated stablecoin payroll for industrial shift workers</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="pill">ChainHack 2026</span>
          <span className="pill">Industrial 5.0</span>
          {deployed && <span className="pill live">Sepolia live</span>}
          {isConnected ? (
            <>
              <span className="pill">{shortAddr(address!)}</span>
              <button type="button" className="btn btn-ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={connecting}
              onClick={() => connect({ connector: connectors[0] })}
            >
              <Wallet size={16} />
              Connect
            </button>
          )}
        </div>
      </header>

      {!deployed && (
        <div className="banner warn">
          Contracts not deployed yet. Run <code>npm run deploy:sepolia</code> from project root
          (requires <code>PRIVATE_KEY</code> in <code>.env</code>).
        </div>
      )}

      {wrongNetwork && (
        <div className="banner error">Switch wallet to Ethereum Sepolia (chain 11155111).</div>
      )}

      <section className="hero">
        <h2>Pay shift workers in minutes — not days</h2>
        <p>
          Upload factory payroll → AI validates compliance → batch stablecoin settlement → workers get
          on-chain receipts. Built for SEA manufacturing &amp; logistics.
        </p>
        <div className="hero-stats">
          <div>
            <strong>AI × Web3</strong>
            <span>Agent blocks bad batches</span>
          </div>
          <div>
            <strong>Real-World Finance</strong>
            <span>Stablecoin batch pay</span>
          </div>
          <div>
            <strong>Industrial 5.0</strong>
            <span>Shift worker workflows</span>
          </div>
        </div>
      </section>

      <ol className="steps">
        <li className={csv ? "done" : ""}>Load shift roster</li>
        <li className={report ? "done" : ""}>AI agent review</li>
        <li className={lastTx ? "done" : ""}>Settle on-chain</li>
        <li>Worker receipts</li>
      </ol>

      <nav className="tabs">
        <button
          type="button"
          className={`tab ${tab === "employer" ? "active" : ""}`}
          onClick={() => setTab("employer")}
        >
          <Building2 size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          Employer
        </button>
        <button
          type="button"
          className={`tab ${tab === "worker" ? "active" : ""}`}
          onClick={() => setTab("worker")}
        >
          <Receipt size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          Worker receipts
        </button>
      </nav>

      {tab === "employer" && (
        <div className="grid grid-2">
          <div className="card">
            <h2>Shift payroll upload</h2>
            <p className="sub">
              Paste CSV or load demo factory roster. AI agent validates before on-chain batch.
            </p>
            <textarea
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setReport(null);
                setParseError("");
              }}
              placeholder="name,wallet,hours,rate_usd,role"
            />
            {parseError && <div className="banner error">{parseError}</div>}
            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label htmlFor="shift">Shift period</label>
              <input
                id="shift"
                type="text"
                value={shiftPeriod}
                onChange={(e) => setShiftPeriod(e.target.value)}
              />
            </div>
            <div className="row-actions">
              <button type="button" className="btn" onClick={loadDemo} disabled={!address}>
                Load demo roster
              </button>
              <button type="button" className="btn btn-primary" onClick={runAgent} disabled={!csv.trim()}>
                <Bot size={16} />
                Run AI agent
              </button>
              <button type="button" className="btn btn-primary" onClick={quickDemo} disabled={!address}>
                Quick demo
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Payroll intelligence agent</h2>
            <p className="sub">Pre-flight compliance — blocks bad batches before settlement.</p>
            {!report ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Upload payroll and run the agent to see validation results.
              </p>
            ) : (
              <>
                <div className="agent-score">
                  <div
                    className={`score-ring ${report.approved ? (report.issues.some((i) => i.severity === "warning") ? "warn" : "ok") : "bad"}`}
                  >
                    {report.score}
                  </div>
                  <div>
                    <strong>{report.approved ? "Approved" : "Blocked"}</strong>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {report.summary}
                    </p>
                  </div>
                </div>
                {report.issues.map((issue, i) => (
                  <div key={i} className={`issue ${issue.severity}`}>
                    {issue.message}
                  </div>
                ))}
              </>
            )}

            {rows.length > 0 && (
              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Role</th>
                      <th>Hours</th>
                      <th>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.name}-${r.role}`}>
                        <td>{r.name}</td>
                        <td>{r.role}</td>
                        <td>{r.hours}h</td>
                        <td>${r.amountUsd.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
                  Batch total: <strong>${totalDisplay} sUSD</strong>
                </p>
              </div>
            )}

            <div className="row-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="btn" onClick={faucet} disabled={busy || !deployed || !address}>
                <Coins size={16} />
                Faucet sUSD
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={settleBatch}
                disabled={busy || !report?.approved || !deployed || wrongNetwork}
              >
                {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                Settle batch
              </button>
            </div>
            {usdcBalance !== undefined && (
              <p className="status-line">Balance: {formatUnits(usdcBalance, 6)} sUSD</p>
            )}
          </div>
        </div>
      )}

      {tab === "worker" && (
        <div className="card">
          <h2>On-chain wage receipts</h2>
          <p className="sub">
            Verifiable payment history for shift workers — auditors and workers share the same source
            of truth.
          </p>
          {!address ? (
            <p style={{ color: "var(--text-muted)" }}>Connect wallet to view your receipts.</p>
          ) : !receiptIds?.length ? (
            <p style={{ color: "var(--text-muted)" }}>
              No receipts yet. Run a batch from the Employer tab (demo pays your connected wallet).
            </p>
          ) : (
            receiptIds.map((id) => <ReceiptCard key={id} receiptId={id as Hex} ledger={d.contracts.shiftLedger} />)
          )}
        </div>
      )}

      <p className="status-line">{status}</p>
      {lastTx && (
        <p className="status-line">
          Last tx:{" "}
          <a href={explorerTx(lastTx)} target="_blank" rel="noreferrer">
            {shortAddr(lastTx)} <ExternalLink size={12} style={{ verticalAlign: -2 }} />
          </a>
        </p>
      )}

      {deployed && (
        <p className="footer-note">
          ShiftLedger ·{" "}
          <a href={explorerAddr(d.contracts.shiftLedger)} target="_blank" rel="noreferrer">
            Contract
          </a>{" "}
          · Industrial 5.0 × Real-World Finance
        </p>
      )}
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

  const [, batchId, employer, , amount, shiftPeriod, role, paidAt] = data;
  const paidDate = new Date(Number(paidAt) * 1000).toLocaleString();

  return (
    <div className="receipt">
      <div className="receipt-head">
        <div>
          <strong>{role as string}</strong>
          <div className="receipt-meta">Shift {shiftPeriod as string}</div>
        </div>
        <div className="receipt-amount">${formatUnits(amount as bigint, 6)}</div>
      </div>
      <div className="receipt-meta">
        Paid {paidDate} · Employer {shortAddr(employer as string)} · Batch {shortAddr(batchId as string)}
      </div>
    </div>
  );
}
