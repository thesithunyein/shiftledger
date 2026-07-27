# ShiftLedger — ChainHack 2026 Win Plan

## Research summary (Jul 27, 2026)

### Market timing (SEA credibility)
- **BPI × Meridian** announced stablecoin payroll pilot for Filipino freelancers (Jul 24–26, 2026) — judges will recognize the trend.
- **Deel DLUSD**, **Toku**, **Bitwage** serve global/contractor payroll — none target **factory shift workers** with **on-chain verifiable receipts + AI pre-flight validation**.
- **Differentiation:** ShiftLedger = *industrial shift payroll* for factories/logistics in SEA, not generic freelancer wallets.

### ChainHack judging map (max $2,000 first place)

| Weight | Criterion | ShiftLedger answer |
|--------|-----------|-------------------|
| 20% | Industrial 5.0 | Factory payroll clerk pays line operators after shift close |
| 20% | Innovation | AI agent validates payroll CSV *before* on-chain batch settlement |
| 20% | Technical execution | Live Sepolia USDC batch pay + receipt explorer |
| 15% | Real-world use | Migrant workers, delayed wages, audit trail for HR/compliance |
| 15% | Feasibility | Open-source, extends to MYR off-ramp / ERP integrations |
| 10% | Pitch/demo | 3-tab demo: Upload → AI Review → Settle → Worker receipt |

### Tracks hit
1. **Real-World Finance** — stablecoin batch settlement
2. **AI × Web3** — payroll intelligence agent
3. **Industrial 5.0 Applications** — shift worker workflows
4. **Consumer** — worker wallet receipt view (Web2-friendly)

### Sponsor angle (banner: Google Cloud, AWS, Razer)
- Architecture doc mentions **cloud-native AI validation** (serverless-ready `/api/validate`)
- MVP ships **client-side agent** (no API key required for demo reliability)
- README notes GCP Cloud Run / AWS Lambda as production path

### Scope (9-day MVP — do NOT overbuild)

**In scope**
- `ShiftLedger.sol` — batch USDC pay, immutable receipts
- Employer UI — CSV upload + demo dataset + AI validation report
- Worker UI — connect wallet → payment history + receipt cards
- Sepolia deploy + Vercel frontend
- README with pitch, architecture, setup

**Out of scope (mention in “next steps”)**
- MYR off-ramp, KYC, multi-sig treasury, ERP connectors

### Demo script (3 min pitch)
1. **Problem:** Factory pays 50 shift workers weekly — bank delays, no worker proof, audit pain.
2. **Solution:** Upload shift payroll → AI flags anomalies → one-click USDC batch → workers get on-chain receipts.
3. **Live demo:** Demo factory data → AI review (1 flagged overtime) → settle → switch to worker wallet → receipt appears.
4. **Why now:** BPI stablecoin payroll pilot + Industrial 5.0 + ASEAN manufacturing hub (Malaysia).
5. **Next:** PHPC/MYR rails, HRIS export, Cloud Run LLM upgrade.

### Build order
1. Contracts + deploy script
2. AI validation engine
3. Employer flow
4. Worker receipt view
5. README + polish
