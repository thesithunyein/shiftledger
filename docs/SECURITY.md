# Security

## Current status

ShiftLedger is in **public pilot on Ethereum Sepolia** with a mock stablecoin (sUSD). Treat balances as test funds only.

## What we do

- Settlement and receipts run through audited-pattern OpenZeppelin ERC-20 flows
- Employers must approve spend before `settleBatch`
- Roster review blocks invalid payout accounts and out-of-policy hours before pay
- CI compiles contracts and runs unit tests on every push

## What you should know

- This is **not** mainnet production yet
- The testnet token includes a **faucet** for pilot funding — mainnet will not
- Browser wallets control signing; protect your keys like any other account
- Do not send real mainnet assets to Sepolia contract addresses

## Reporting issues

Open a GitHub issue with the `security` label, or contact the maintainer via the GitHub profile on [thesithunyein/shiftledger](https://github.com/thesithunyein/shiftledger).

Please avoid posting private keys or seed phrases.
