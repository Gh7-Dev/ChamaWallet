#![no_std]
#[allow(deprecated)]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};
use soroban_sdk::token::Client as TokenClient;
const APPROVAL_THRESHOLD: u32 = 2;
const LEDGER_TTL: u32 = 535_000; // ~30 days

#[contracttype]
pub struct Chama {
    name: Symbol,
    admin: Address,
    balance: i128,
    members: Vec<Address>,
}
#[contracttype]
pub struct Proposal {
    pub amount: i128,
    pub recipient: Address,
    pub approvals: u32,
    pub executed: bool,
}
#[contracttype]
enum DataKey {
    ChamaData(Symbol),
    Proposal(Symbol),
}

fn get_chama_data(env: &Env, name: &Symbol) -> Chama {
    let key = DataKey::ChamaData(name.clone());
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
    env.storage().persistent().get(&key).unwrap()
}

fn set_chama_data(env: &Env, name: &Symbol, chama: &Chama) {
    let key = DataKey::ChamaData(name.clone());
    env.storage().persistent().set(&key, chama);
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

fn get_proposal(env: &Env, name: &Symbol) -> Proposal {
    let key = DataKey::Proposal(name.clone());
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
    env.storage().persistent().get(&key).unwrap()
}

fn set_proposal(env: &Env, name: &Symbol, proposal: &Proposal) {
    let key = DataKey::Proposal(name.clone());
    env.storage().persistent().set(&key, proposal);
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

#[contract]
pub struct ChamaVault;

#[contractimpl]
impl ChamaVault {
    pub fn create_chama(env: Env, name: Symbol, admin: Address) {
        let chama = Chama { name: name.clone(), admin: admin.clone(), balance: 0, members: Vec::new(&env) };
        set_chama_data(&env, &name, &chama);
        env.events().publish((Symbol::new(&env, "created"), name.clone()), admin)
    }

    pub fn add_member(env: Env, name: Symbol, admin: Address, new_member: Address) {
        admin.require_auth();
        let mut chama = get_chama_data(&env, &name);
        chama.members.push_back(new_member);
        set_chama_data(&env, &name, &chama);
    }

    pub fn deposit(env: Env, name: Symbol, from: Address, token_id: Address, amount: i128) {
        from.require_auth();
        let mut chama = get_chama_data(&env, &name);
        TokenClient::new(&env, &token_id).transfer(&from, &env.current_contract_address(), &amount);
        chama.balance += amount;
        set_chama_data(&env, &name, &chama);
        env.events().publish((Symbol::new(&env, "deposited"), name), &amount)
    }

    pub fn propose_withdrawal(env: Env, chama_name: Symbol, proposer: Address, amount: i128, recipient: Address) {
        proposer.require_auth();
        let chama = get_chama_data(&env, &chama_name);
        if !chama.members.contains(&proposer) {
            panic!("Not a chama member");
        }
        let proposal = Proposal { amount, recipient, approvals: 0, executed: false };
        set_proposal(&env, &chama_name, &proposal);
        env.events().publish((Symbol::new(&env, "proposed"), &chama_name), &amount)
    }

    pub fn approve_withdrawal(env: Env, chama_name: Symbol, approver: Address, token_id: Address) {
        let mut proposal = get_proposal(&env, &chama_name);
        let chama = get_chama_data(&env, &chama_name);
        if !chama.members.contains(&approver) {
            panic!("Not a member");
        }
        if proposal.executed {
            panic!("Withdrawal already executed");
        }
        proposal.approvals += 1;
        if proposal.approvals >= APPROVAL_THRESHOLD {
            TokenClient::new(&env, &token_id).transfer(&env.current_contract_address(), &proposal.recipient, &proposal.amount);
            proposal.executed = true;
        }
        set_proposal(&env, &chama_name, &proposal);
        env.events().publish((Symbol::new(&env, "Approved"), chama_name), &approver);
    }

    pub fn get_chama(env: Env, chama_name: Symbol) -> Chama {
        get_chama_data(&env, &chama_name)
    }
}
