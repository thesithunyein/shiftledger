import { BrandMark } from "./BrandMark";

export function SiteBar({
  isConnected,
  connecting,
  address,
  onConnect,
  onDisconnect,
  tab,
  onTabChange,
}: {
  isConnected: boolean;
  connecting: boolean;
  address?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  tab: "employer" | "worker";
  onTabChange: (tab: "employer" | "worker") => void;
}) {
  return (
    <header className="sitebar">
      <div className="sitebar-inner">
        <a className="sitebar-brand" href="/">
          <BrandMark size={36} />
          <span className="sitebar-title">ShiftLedger</span>
        </a>

        <span className="sitebar-pill">Sepolia</span>

        <nav className="sitebar-nav" aria-label="Main">
          <button
            type="button"
            className={`sitebar-link ${tab === "employer" ? "active" : ""}`}
            onClick={() => onTabChange("employer")}
          >
            Payroll
          </button>
          <button
            type="button"
            className={`sitebar-link ${tab === "worker" ? "active" : ""}`}
            onClick={() => onTabChange("worker")}
          >
            Receipts
          </button>
        </nav>

        <div className="sitebar-actions">
          {isConnected ? (
            <>
              <span className="wallet-chip">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              <button type="button" className="btn btn-ghost" onClick={onDisconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={connecting} onClick={onConnect}>
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
