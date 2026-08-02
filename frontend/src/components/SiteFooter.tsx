import { explorerAddr } from "../lib/deployment";

export function SiteFooter({
  ledgerAddress,
  deployed,
}: {
  ledgerAddress?: string;
  deployed?: boolean;
}) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <strong>ShiftLedger</strong>
          <p>Factory payroll with verified pay slips.</p>
        </div>
        <div className="site-footer-links">
          {deployed && ledgerAddress ? (
            <a href={explorerAddr(ledgerAddress)} target="_blank" rel="noreferrer">
              Payment ledger
            </a>
          ) : null}
          <a href="https://github.com/thesithunyein/shiftledger" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/thesithunyein/shiftledger/blob/master/docs/SECURITY.md"
            target="_blank"
            rel="noreferrer"
          >
            Security
          </a>
          <a
            href="https://github.com/thesithunyein/shiftledger/blob/master/docs/ARCHITECTURE.md"
            target="_blank"
            rel="noreferrer"
          >
            Architecture
          </a>
        </div>
        <p className="site-footer-meta">Sepolia pilot · MIT License · © {new Date().getFullYear()} ShiftLedger</p>
      </div>
    </footer>
  );
}
