 # ChamaVault
A Soroban smart contract for transparent group treasury management on Stellar, built for chama savings groups in East Africa.

## The Problem
Many chamas in East Africa loss significant savings  due to unsecure and unauthorized, secretive and unlawful withdrawal of the chama funds some of which are transacted without the knowledge of the chama members.This leads to lack of accountabilty and eventual collapse of such groups.

# The Solution
Having been built on stellar and being a soroban smart contract, ChamaVault applies the transparency trait of blockchain and a feature called multi-signatures in which 2 of N chama members have to authorize a transaction before it's actually procesed. This improves transparency and accountabilty in chamas making them able to economically transform lives.

## Features
 - Create a chama group
 - Add members
 - Deposit funds via token transfer
 - Propose withdrawals
 - Multi-signature approval(2 of N members must approve)
 - View group data

## Tech Stack
 - Rust
 - Soroban SDK v26
 - Stellar testnet

## Contract functions
- fn create_chama()- creates a new chama group
- fn add_member()- facilitates addition of a new member into the chama
- fn deposit()- facilitates secure funds deposit through token tranfer
- fn propose_withdrawal()- Allows only active and authorized members to ask for funds withdrawals
- fn approve_withdrawal()- facilitates multi-signature withdrawal of funds via token transfer
- fn get_chama() - Returns group data

## Running tests
cargo test

## Testnet Contract ID
CB4IQW7N33KD7WKX53WRGOXGIONRTQLRUUH7CLSPHPY44I2632T45KOV