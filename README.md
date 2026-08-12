# ChamaWallet

A Soroban smart contract and bilingual web app for transparent, multi-signature
treasury management for chama savings groups in East Africa — built on Stellar.

## The problem

Chamas across East Africa lose significant savings to unauthorized, secretive
withdrawals — funds moved without the knowledge or consent of the group's
members. This erodes trust and causes otherwise healthy savings groups to
collapse.

## The solution

ChamaWallet puts a chama's treasury on-chain. Every withdrawal requires
approval from two independent members before funds move, and every group's
balance and membership is publicly verifiable — no single person can quietly
drain the account.

## Governance model

A group isn't controlled by one admin. It's founded by three people, each
claiming their own role with their own wallet — nobody ever enters another
person's address anywhere in the app:

1. **Propose** — one founder proposes the group and claims one of the three
   seats (Chairperson, Secretary, or Treasurer) for themselves.
2. **Fill the remaining seats** — the other two open an invite link, connect
   their own wallet, and claim their own seat. The group is `Proposed` — not
   usable by anyone — until all three seats are filled.
3. **Activate** — the moment the third seat is filled, the group becomes
   `Active` in that same transaction. No separate "activate" step.
4. **Regular members join by request** — once active, anyone can request to
   join; the Secretary approves or the request stays pending.
5. **Withdrawals need two signatures** — any member can propose a withdrawal;
   it executes automatically once two members approve it.

## Tech stack

**Contract**
- Rust, Soroban SDK 26
- Stellar Testnet

**Frontend** ([chamawallet-frontend/](chamawallet-frontend/))
- React 19 + Vite
- `@stellar/stellar-sdk`, `@stellar/freighter-api` (wallet connect + signing)
- Bilingual UI (English / Swahili) with a single language toggle
- Nickname system — no raw wallet addresses are ever shown to users
- No backend — all state lives on-chain or in the browser's `localStorage`

## Contract functions

| Function | Who calls it | What it does |
|---|---|---|
| `propose_chama(name, role, address)` | Anyone | Proposes a new group, claiming one founding seat for the caller |
| `fill_role(chama_name, address, role)` | The other two founders | Claims an open founding seat with the caller's own address; activates the group once all three are filled |
| `request_join(chama_name, requester)` | Anyone | Requests membership in an Active group |
| `approve_join(chama_name, secretary, new_member)` | Secretary only | Approves a pending join request |
| `deposit(name, from, token_id, amount)` | Any member | Deposits SEP-41 tokens into the group's balance |
| `propose_withdrawal(chama_name, proposer, amount, recipient)` | Any member | Proposes a withdrawal |
| `approve_withdrawal(chama_name, approver, token_id)` | Any member | Approves a pending withdrawal; executes automatically at 2 approvals |
| `get_chama(chama_name)` | Anyone (read-only) | Returns the group's full state |
| `get_role(chama_name, member)` | Anyone (read-only) | Returns a member's role, if any |

## Project structure

```
contracts/chama_wallet/    Soroban contract (Rust)
chamawallet-frontend/      React + Vite web app
```

## Running the contract

```bash
cd contracts/chama_wallet
cargo test            # unit tests (soroban-sdk testutils)
stellar contract build # -> target/wasm32v1-none/release/chama_wallet.wasm
```

> **Note (Windows):** `cargo test`/`cargo check` require MSVC Build Tools to
> link the host-target test binary. If those aren't installed, `stellar
> contract build` still works — it only needs the `wasm32v1-none` target,
> which doesn't touch the host linker.

## Running the frontend

```bash
cd chamawallet-frontend
npm install
npm start      # dev server, http://localhost:5173
npm run build  # production build -> dist/
```

Requires the [Freighter](https://www.freighter.app/) browser extension,
connected to Stellar Testnet.

## Deployed testnet contract

```
CCBCXYFUNTXZ5A76QPQEPHCRBOT7NQ5KXZSUUOTOTSMWRM2R7Y7EFJUI
```

## Known limitations

- The contract has no getter for a group's pending withdrawal proposal — the
  frontend tracks proposal/approval state locally (per browser) as a display
  hint, not an authoritative on-chain read.
- Renaming a wallet address's nickname or switching browsers resets local
  state (nickname, language, active group) — nothing is migrated between
  devices since it's stored only in `localStorage`, by design (no backend).
