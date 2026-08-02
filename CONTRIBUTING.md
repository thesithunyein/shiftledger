# Contributing

Thanks for helping improve ShiftLedger.

## Setup

```bash
npm run install:all
cp .env.example .env
npm run compile
npm run test
npm run dev
```

## Guidelines

- Keep the product language payroll-first (HR / workers), not crypto jargon
- Prefer small, focused pull requests
- Run `npm run test` and `npm run build` before opening a PR
- Do not commit `.env`, private keys, or hackathon-only notes

## Project layout

- `frontend/` — payroll workspace
- `contracts/` — Solidity + Hardhat tests
- `docs/` — architecture and security
