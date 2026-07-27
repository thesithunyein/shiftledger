# ChainHack 2026 — Submission Copy

Paste these into HackQuest when submitting (deadline **Aug 5, 11:59 PM MYT**).

---

## Project name
```
ShiftLedger
```

## One-line tagline
```
AI-validated stablecoin payroll for industrial shift workers — verifiable wage receipts on-chain.
```

## Project description (short)
```
ShiftLedger helps factory payroll clerks pay shift workers in stablecoin with an AI pre-flight check and on-chain wage receipts.

Employers upload a shift roster (CSV). An AI payroll agent validates hours, rates, and wallets before settlement. Approved batches settle in one on-chain transaction — each worker receives USDC and an immutable receipt tied to shift period and role.

Built for Industrial 5.0 in Southeast Asia: human-centric payroll, AI-assisted compliance, and digital finance for manufacturing and logistics teams.
```

## Tracks
- Real-World Finance
- AI × Web3
- Industrial 5.0 Applications

## Problem
Factory and logistics operators pay shift workers weekly through slow bank rails. Workers lack portable proof of payment; HR reconciles manually. Cross-border and gig workers face 6%+ remittance fees.

## Solution
CSV payroll → AI agent validation → stablecoin batch settlement → worker receipts on-chain.

## Target users
- **Employer:** Factory HR / payroll clerk (Malaysia, Philippines, SEA manufacturing)
- **Worker:** Line operators, QC, logistics staff who need instant proof of wages

## Demo flow (3 min)
1. Connect Sepolia wallet
2. Employer → Load demo roster → Run AI agent (see overtime flag)
3. Faucet sUSD → Settle batch
4. Worker tab → view on-chain receipts + Etherscan link

## Built during hackathon
- Jul 27–Aug 5, 2026: contracts, AI agent, frontend, Sepolia deployment
- New repository created for ChainHack (not recycled from other bounties)

## Tech stack
- Solidity (ShiftLedger.sol, MockUSDC)
- React + wagmi + viem
- TypeScript payroll intelligence agent

## Links (fill after deploy)
- **Live demo:** `https://shiftledger.vercel.app` (or your Vercel URL)
- **GitHub:** `https://github.com/thesithunyein/shiftledger`
- **Contract (Sepolia):** see README

## Pitch script (30 sec)
> Factories pay shift workers weekly through slow banks — workers have no proof, HR reconciles manually. ShiftLedger: upload payroll, AI validates anomalies, one-click stablecoin batch, workers get on-chain receipts. Built for Industrial 5.0 in Southeast Asia — same week BPI announced stablecoin payroll pilots.

## Judging criteria mapping

| Criteria | How we score |
|----------|--------------|
| Industrial 5.0 (20%) | Shift workers, factory payroll, SEA manufacturing |
| Innovation (20%) | AI gates settlement; receipts ≠ generic wallet |
| Technical (20%) | Live Sepolia batch pay + receipt reads |
| Real-world (15%) | BPI/Deel/Toku trend; clear HR + worker personas |
| Feasibility (15%) | MYR off-ramp, ERP export as next steps |
| Pitch (10%) | 4-step demo, clear problem/solution |

## Next steps (post-hackathon)
- MYR/PHP off-ramp via regulated partners
- Cloud Run LLM for payroll agent
- HRIS CSV export + auditor dashboard
