export function SiteBar({
  deployed,
  isConnected,
  connecting,
  address,
  onConnect,
  onDisconnect,
  tab,
  onTabChange,
}: {
  deployed: boolean;
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
          <img src="/logo.png" alt="ShiftLedger" className="sitebar-logo" />
          <div className="sitebar-brand-text">
            <span className="sitebar-title">ShiftLedger</span>
            <span className="sitebar-tagline">Industrial shift payroll</span>
          </div>
        </a>

        <nav className="sitebar-nav" aria-label="Main">
          <button
            type="button"
            className={`sitebar-link ${tab === "employer" ? "active" : ""}`}
            onClick={() => onTabChange("employer")}
          >
            Employer
          </button>
          <button
            type="button"
            className={`sitebar-link ${tab === "worker" ? "active" : ""}`}
            onClick={() => onTabChange("worker")}
          >
            Worker receipts
          </button>
          <a
            className="sitebar-link"
            href="https://github.com/thesithunyein/shiftledger"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>

        <div className="sitebar-actions">
          {deployed && <span className="pill pill-live">Sepolia</span>}
          <span className="pill">ChainHack 2026</span>
          {isConnected ? (
            <>
              <span className="pill pill-wallet">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
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
