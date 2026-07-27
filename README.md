<p align="center">
  <strong>ShiftLedger</strong><br/>
  AI-validated stablecoin payroll for industrial shift workers
</p>

<p align="center">
  <a href="https://shiftledger-nine.vercel.app"><img src="https://img.shields.io/badge/Live-Demo-f5a623?style=for-the-badge" alt="Live demo" /></a>
  <a href="https://sepolia.etherscan.io/address/0x5b421eb54218b48c7064605fb957ffef2b6b5f8a"><img src="https://img.shields.io/badge/Sepolia-Contract-627EEA?style=for-the-badge&logo=ethereum&logoColor=white" alt="Sepolia" /></a>
  <a href="https://www.hackquest.io/hackathons/ChainHack"><img src="https://img.shields.io/badge/ChainHack-2026-3ecf8e?style=for-the-badge" alt="ChainHack" /></a>
</p>

<p align="center">
  <a href="https://shiftledger-nine.vercel.app">Live app</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="SUBMISSION.md">Submission copy</a>
</p>

---

## What it is

**ShiftLedger** helps factory payroll clerks pay shift workers in stablecoin with an **AI pre-flight check** and **on-chain wage receipts**.

| Step | Who | Action |
|------|-----|--------|
| 1 | Employer | Upload shift payroll CSV |
| 2 | AI agent | Validate hours, rates, wallets |
| 3 | Employer | Batch-settle sUSD on Sepolia |
| 4 | Worker | View verifiable payment receipts |

Built for **[ChainHack 2026](https://www.hackquest.io/hackathons/ChainHack)** — Industrial 5.0 × AI × Web3.

---

## Why judges care

- **Industrial 5.0** — shift workers in manufacturing/logistics, not generic freelancer wallets
- **AI × Web3** — agent blocks bad payroll *before* on-chain settlement
- **Real-World Finance** — stablecoin batch pay + immutable audit trail
- **SEA relevance** — same week as BPI stablecoin payroll pilots (Jul 2026)

---

## Try it (3 min demo)

1. Open **[shiftledger-nine.vercel.app](https://shiftledger-nine.vercel.app)** (or `npm run dev`)
2. Connect wallet on **Ethereum Sepolia**
3. **Quick demo** → AI flags overtime row → **Faucet sUSD** → **Settle batch**
4. **Worker receipts** tab → on-chain payment history

---

## Sepolia contracts

| Contract | Address |
|----------|---------|
| ShiftLedger | [`0x5b42…5f8a`](https://sepolia.etherscan.io/address/0x5b421eb54218b48c7064605fb957ffef2b6b5f8a) |
| MockUSDC (sUSD) | [`0x4c48…76d6`](https://sepolia.etherscan.io/address/0x4c485e4028041e9b27ee65efcfe1cd74f0ca76d6) |

---

## Stack

| Layer | Tech |
|-------|------|
| Contracts | Hardhat 3 · Solidity · OpenZeppelin |
| Stablecoin | MockUSDC (sUSD) on Sepolia |
| App | Vite · React · wagmi · viem |
| AI agent | Payroll intelligence engine (LLM-ready) |

---

## Setup

```bash
git clone https://github.com/thesithunyein/shiftledger.git
cd shiftledger
npm run install:all
cp .env.example .env   # PRIVATE_KEY + SEPOLIA_RPC_URL
npm run compile
npm run deploy:sepolia   # skip if using bundled addresses
npm run dev
```

Vercel root directory: `frontend`

---

## Pitch (30 sec)

> Factories pay shift workers weekly through slow banks — workers have no proof, HR reconciles manually. ShiftLedger: upload payroll, AI validates anomalies, one-click stablecoin batch, workers get on-chain receipts. Built for Industrial 5.0 in Southeast Asia.

---

## License

MIT
