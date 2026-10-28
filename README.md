# ChamaWallet

ChamaWallet is a bilingual (English / Swahili) web application and Soroban smart contract for multi-signature treasury management for chama savings groups in East Africa. It is built on Stellar and is intended to make group membership, deposits, and withdrawal approval more transparent.

## Problem

Savings groups need a clear way to govern shared funds and make treasury activity visible to members. ChamaWallet explores an on-chain approach where group membership and balances can be inspected and withdrawals require more than one member's approval.

## Governance flow

1. A founder proposes a group and claims one of three founding roles: Chairperson, Secretary, or Treasurer.
2. The other two founders connect their own wallets and claim the remaining roles.
3. The group becomes active when all three founding seats are filled.
4. Regular members can request to join; the Secretary approves or leaves the request pending.
5. A member can propose a withdrawal; it executes after two members approve it.

## Technology

- **Smart contract:** Rust, Soroban SDK 26
- **Network:** Stellar Testnet
- **Frontend:** React 19, Vite, `@stellar/stellar-sdk`, and `@stellar/freighter-api`
- **Backend service:** Node.js, TypeScript, Express, Stellar SDK, and PostgreSQL dependencies for fee sponsorship / relayer functionality and transaction-related records

The frontend also uses browser `localStorage` for local UI preferences and display state. This is not the same as authoritative on-chain state. The repository contains a backend service, so the project should not be described as having no backend.

## Smart-contract functions documented in the current implementation

| Function | Purpose |
|---|---|
| `propose_chama` | Proposes a group and claims a founding role. |
| `fill_role` | Claims an open founding role; the group activates once all three roles are filled. |
| `request_join` | Requests membership in an active group. |
| `approve_join` | Allows the Secretary to approve a pending join request. |
| `deposit` | Deposits SEP-41 tokens into the group. |
| `propose_withdrawal` | Proposes a withdrawal. |
| `approve_withdrawal` | Approves a pending withdrawal; execution occurs at two approvals. |
| `get_chama` | Reads group state. |
| `get_role` | Reads a member's role. |

## Repository structure

```text
.
├── contracts/chama_wallet/     Soroban contract (Rust)
├── chamawallet-frontend/       React + Vite application
├── backend/                    Node.js / TypeScript relayer service
└── README.md
```

## Run the smart contract tests and build

From the repository root:

```bash
cd contracts/chama_wallet
cargo test
stellar contract build
```

The contract build produces a WebAssembly artifact for deployment with the Stellar CLI.

## Run the frontend

```bash
cd chamawallet-frontend
npm install
npm start
npm run build
```

The frontend expects the Freighter browser extension connected to Stellar Testnet.

## Backend service

The backend is in `backend/`. Its package scripts include build, development start, database migration, and tests.

```bash
cd backend
npm install
npm test
npm run build
```

Configure environment variables locally as required by the backend's configuration. Do not commit credentials, database passwords, or Stellar secret keys.

## Testnet contract

The repository currently lists this contract ID:

```text
CCBCXYFUNTXZ5A76QPQEPHCRBOT7NQ5KXZSUUOTOTSMWRM2R7Y7EFJUI
```

Verify the deployment against the current source before relying on it.

## Known limitations

- The README and codebase should be kept aligned as the frontend and relayer evolve.
- The contract does not expose a getter for a group's pending withdrawal proposal; the frontend README currently notes that proposal/approval display state may be tracked locally.
- Browser-local preferences such as nicknames, language, and active group are not automatically shared between browsers or devices.
- This project should be treated as a testnet prototype unless and until deployment, security review, and operational requirements have been verified.
