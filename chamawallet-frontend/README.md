# ChamaWallet Frontend

React + Vite web app for ChamaWallet. See the [root README](../README.md)
for the full project overview, governance model, and contract details.

## Scripts

```bash
npm install
npm start      # dev server at http://localhost:5173
npm run build  # production build -> dist/
npm run preview # preview the production build locally
```

## Requirements

- [Freighter](https://www.freighter.app/) browser extension, set to Stellar
  Testnet — the app has no fallback for interacting with the contract
  without it.

## Structure

```
src/
  App.jsx            Wallet connect, nickname onboarding, language state,
                      centralized group/role data shared by every page
  stellar.js          All Soroban/Freighter contract calls and helpers
  translations.js      Bilingual (English/Swahili) copy table
  components/          Shared UI: nav, state screens, GroupCard, RoleBadge, AccessGate
  pages/                Welcome, Dashboard (search/create), My Group, Deposit,
                        Withdrawals, Admin (create group + join requests)
```

No backend and no build-time environment config — the contract ID, network,
and RPC URL are constants in `stellar.js`.
