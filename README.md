<p align="center">
  <img src="frontend/public/logo.svg" alt="ShiftLedger" width="88" />
</p>

<h1 align="center">ShiftLedger</h1>

<p align="center">
  Stablecoin payroll for industrial shift workers — validate, batch pay, verify on-chain.
</p>

<p align="center">
  <a href="https://shiftledger-nine.vercel.app"><strong>Live app</strong></a>
  ·
  <a href="https://sepolia.etherscan.io/address/0x5b421eb54218b48c7064605fb957ffef2b6b5f8a">Contract</a>
  ·
  <a href="docs/ARCHITECTURE.md">Architecture</a>
</p>

---

## Overview

ShiftLedger lets employers upload a shift payroll roster, run automated validation, and settle wages in stablecoin with on-chain receipts for each worker.

```
CSV roster → validation → batch settlement → worker receipts
```

---

## Demo

1. Open [shiftledger-nine.vercel.app](https://shiftledger-nine.vercel.app)
2. Connect a Sepolia wallet
3. **Load sample** → **Validate** → **Get sUSD** → **Settle**
4. Switch to **Receipts** to view payment history

---

## Contracts (Sepolia)

| | Address |
|---|---|
| ShiftLedger | [`0x5b421eb54218b48c7064605fb957ffef2b6b5f8a`](https://sepolia.etherscan.io/address/0x5b421eb54218b48c7064605fb957ffef2b6b5f8a) |
| sUSD | [`0x4c485e4028041e9b27ee65efcfe1cd74f0ca76d6`](https://sepolia.etherscan.io/address/0x4c485e4028041e9b27ee65efcfe1cd74f0ca76d6) |

---

## Development

```bash
git clone https://github.com/thesithunyein/shiftledger.git
cd shiftledger
npm run install:all
cp .env.example .env
npm run compile
npm run deploy:sepolia
npm run dev
```

---

## License

MIT
