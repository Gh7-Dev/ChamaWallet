#![no_std]
#[allow(deprecated)]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};
use soroban_sdk::token::Client as TokenClient;
const APPROVAL_THRESHOLD: u32 = 2;
const LEDGER_TTL: u32 = 535_000; // ~30 days

#[contracttype]
#[derive(Clone, PartialEq, Eq)]
pub enum ChamaStatus {
    Proposed,
    Active,
}

#[contracttype]
#[derive(Clone, PartialEq, Eq)]
pub enum Role {
    Chairperson,
    Secretary,
    Treasurer,
    Member,
}

#[contracttype]
#[derive(Clone)]
pub struct Chama {
    pub name: Symbol,
    /// Each founding seat starts empty (None) except the one the proposer
    /// claims for themselves. Nobody ever supplies another person's
    /// address — every seat is filled by that person signing their own
    /// fill_role call. The group is not Active, and none of the seat-
    /// holders count as real members, until all three seats are filled.
    pub chairperson: Option<Address>,
    pub secretary: Option<Address>,
    pub treasurer: Option<Address>,
    pub balance: i128,
    pub members: Vec<Address>,
    pub status: ChamaStatus,
    pub pending_members: Vec<Address>,
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
    MemberRole(Symbol, Address),
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

fn set_member_role(env: &Env, name: &Symbol, member: &Address, role: &Role) {
    let key = DataKey::MemberRole(name.clone(), member.clone());
    env.storage().persistent().set(&key, role);
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

#[contract]
pub struct ChamaWallet;

#[contractimpl]
impl ChamaWallet {
    /// Proposes a new chama: the caller claims exactly one founding role
    /// for themselves (their choice — Chairperson, Secretary, or
    /// Treasurer). The other two seats start empty. The group is Proposed
    /// — not Active, not usable by anyone — until two other people each
    /// independently fill_role their own seat with their own wallet.
    pub fn propose_chama(env: Env, name: Symbol, role: Role, address: Address) {
        address.require_auth();
        if env.storage().persistent().has(&DataKey::ChamaData(name.clone())) {
            panic!("Group already exists");
        }
        if role == Role::Member {
            panic!("Invalid founding role");
        }

        let mut members = Vec::new(&env);
        members.push_back(address.clone());

        let mut chama = Chama {
            name: name.clone(),
            chairperson: None,
            secretary: None,
            treasurer: None,
            balance: 0,
            members,
            status: ChamaStatus::Proposed,
            pending_members: Vec::new(&env),
        };
        match role {
            Role::Chairperson => chama.chairperson = Some(address.clone()),
            Role::Secretary => chama.secretary = Some(address.clone()),
            Role::Treasurer => chama.treasurer = Some(address.clone()),
            Role::Member => unreachable!(),
        }
        set_chama_data(&env, &name, &chama);
        set_member_role(&env, &name, &address, &role);
        env.events().publish((Symbol::new(&env, "proposed_group"), name), address);
    }

    /// Fills an empty founding seat (Secretary or Treasurer, or Chairperson
    /// if the proposer took a different seat) with the caller's own
    /// address. Activates the group once all three seats are filled.
    pub fn fill_role(env: Env, chama_name: Symbol, address: Address, role: Role) {
        address.require_auth();
        let mut chama = get_chama_data(&env, &chama_name);

        if chama.status != ChamaStatus::Proposed {
            panic!("Group already active");
        }
        if chama.members.contains(&address) {
            panic!("Already a member");
        }

        match role {
            Role::Chairperson => {
                if chama.chairperson.is_some() {
                    panic!("Chairperson already filled");
                }
                chama.chairperson = Some(address.clone());
            }
            Role::Secretary => {
                if chama.secretary.is_some() {
                    panic!("Secretary already filled");
                }
                chama.secretary = Some(address.clone());
            }
            Role::Treasurer => {
                if chama.treasurer.is_some() {
                    panic!("Treasurer already filled");
                }
                chama.treasurer = Some(address.clone());
            }
            Role::Member => panic!("Invalid founding role"),
        }

        chama.members.push_back(address.clone());
        set_member_role(&env, &chama_name, &address, &role);

        if chama.chairperson.is_some() && chama.secretary.is_some() && chama.treasurer.is_some() {
            chama.status = ChamaStatus::Active;
        }

        set_chama_data(&env, &chama_name, &chama);
        env.events().publish((Symbol::new(&env, "role_filled"), chama_name), address);
    }

    /// Requests membership in an Active group. The secretary must approve
    /// via approve_join before the requester becomes a member.
    pub fn request_join(env: Env, chama_name: Symbol, requester: Address) {
        requester.require_auth();
        let mut chama = get_chama_data(&env, &chama_name);

        if chama.status != ChamaStatus::Active {
            panic!("Group is not yet active");
        }
        if chama.members.contains(&requester) {
            panic!("Already a member");
        }
        if chama.pending_members.contains(&requester) {
            panic!("Request already pending");
        }

        chama.pending_members.push_back(requester);
        set_chama_data(&env, &chama_name, &chama);
    }

    /// Secretary-only: approves a pending join request, moving the
    /// requester from pending_members into members with role Member.
    pub fn approve_join(env: Env, chama_name: Symbol, secretary: Address, new_member: Address) {
        secretary.require_auth();
        let mut chama = get_chama_data(&env, &chama_name);

        if chama.secretary != Some(secretary.clone()) {
            panic!("Only secretary can approve members");
        }

        let index = chama
            .pending_members
            .first_index_of(&new_member)
            .expect("No pending request from this address");
        chama.pending_members.remove(index);
        chama.members.push_back(new_member.clone());
        set_member_role(&env, &chama_name, &new_member, &Role::Member);

        set_chama_data(&env, &chama_name, &chama);
        env.events().publish((Symbol::new(&env, "join_approved"), chama_name), new_member);
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
        approver.require_auth();
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

    pub fn get_role(env: Env, chama_name: Symbol, member: Address) -> Option<Role> {
        let key = DataKey::MemberRole(chama_name, member);
        env.storage().persistent().get(&key)
    }
}

mod test;
