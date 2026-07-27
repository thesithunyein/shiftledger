# ShiftLedger Architecture

## Problem

Factory and logistics operators in Southeast Asia pay shift workers weekly through slow bank rails. Workers lack portable proof of payment; HR and auditors reconcile manually.

## Solution

```
CSV payroll → AI agent validation → USDC batch settle → on-chain receipts
```

## Components

| Layer | Tech | Role |
|-------|------|------|
| Payroll agent | TypeScript rules engine | Pre-flight compliance before settlement |
| ShiftLedger.sol | Solidity + OpenZeppelin | Batch pull USDC, pay workers, store receipts |
| MockUSDC | ERC-20 faucet | Sepolia demo stablecoin |
| Frontend | Vite, React, wagmi | Employer + worker views |

## Flow

1. **Employer** loads shift roster (CSV or demo data).
2. **AI agent** flags invalid wallets, excessive hours, unusual rates.
3. **Employer** approves sUSD and calls `settleBatch`.
4. **Workers** view immutable receipts tied to shift period and role.

## ChainHack alignment

- **Industrial 5.0** — shift worker payroll workflows
- **AI × Web3** — agent gates on-chain settlement
- **Real-World Finance** — stablecoin batch payments
- **SEA relevance** — parallels BPI/Meridian stablecoin payroll pilots (Jul 2026)

## Production path

- Replace rules engine with Cloud Run / Lambda LLM endpoint
- MYR off-ramp via regulated partners (BSP sandbox, etc.)
- ERP export (CSV/PDF) for HRIS integration
