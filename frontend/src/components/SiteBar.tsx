import { FileText, LogOut, WalletCards } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../lib/theme";

export function SiteBar({
  isConnected,
  connecting,
  address,
  onConnect,
  onDisconnect,
  tab,
  onTabChange,
  theme,
  onToggleTheme,
  showNav = true,
}: {
  isConnected: boolean;
  connecting: boolean;
  address?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  tab: "employer" | "worker";
  onTabChange: (tab: "employer" | "worker") => void;
  theme: Theme;
  onToggleTheme: () => void;
  showNav?: boolean;
}) {
  return (
    <header className="sitebar">
      <div className="sitebar-inner">
        <a className="sitebar-brand" href="/">
          <BrandMark size={36} theme={theme} />
          <span className="sitebar-wordmark">
            <span className="sitebar-title">ShiftLedger</span>
            <span className="sitebar-tag">Factory payroll</span>
          </span>
        </a>

        {showNav && (
          <nav className="sitebar-nav" aria-label="Main">
            <button
              type="button"
              className={`sitebar-link ${tab === "employer" ? "active" : ""}`}
              onClick={() => onTabChange("employer")}
            >
              <WalletCards size={15} className="nav-icon" strokeWidth={2.25} />
              Payroll
            </button>
            <button
              type="button"
              className={`sitebar-link ${tab === "worker" ? "active" : ""}`}
              onClick={() => onTabChange("worker")}
            >
              <FileText size={15} className="nav-icon" strokeWidth={2.25} />
              Pay slips
            </button>
          </nav>
        )}

        <div className="sitebar-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {isConnected ? (
            <>
              <span className="wallet-chip" title={address}>
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
              <button type="button" className="btn btn-ghost" onClick={onDisconnect}>
                <LogOut size={15} className="btn-icon" />
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" disabled={connecting} onClick={onConnect}>
              {connecting ? "Signing in…" : "Sign in"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
