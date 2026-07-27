# Architecture

## Flow

1. Employer uploads shift payroll (CSV)
2. Validation engine checks hours, rates, and wallet addresses
3. Approved batch settles via `ShiftLedger.settleBatch`
4. Workers read immutable receipts from chain

## Stack

- **Contracts** — Solidity, OpenZeppelin, Hardhat
- **App** — React, wagmi, viem
- **Network** — Ethereum Sepolia (demo)

## Contracts

- `ShiftLedger` — batch USDC pull, per-worker transfer, receipt storage
- `MockUSDC` — demo stablecoin with faucet
