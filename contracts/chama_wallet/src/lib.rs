#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Bytes, BytesN, Env, Symbol, Vec};
use soroban_sdk::token::Client as TokenClient;
const APPROVAL_THRESHOLD: u32 = 2;
const LEDGER_TTL: u32 = 535_000; // ~30 days
const MULTISIG_THRESHOLD: u32 = 2;

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ChamaStatus {
    Proposed,
    Active,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Role {
    Chairperson,
    Secretary,
    Treasurer,
    Member,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PasskeyPublicKey {
    pub x: BytesN<32>,
    pub y: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub struct Chama {
    pub name: Symbol,
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
    pub id: u64,
    pub proposer: Address,
    pub amount: i128,
    pub recipient: Address,
    pub approvals: Vec<Address>,
    pub executed: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RecoveryRequest {
    pub target_user: Address,
    pub new_passkey: PasskeyPublicKey,
    pub approvals: Vec<Address>,
}
#[contracttype]
enum DataKey {
    ChamaData(Symbol),
    UserPasskey(Address),
    Proposal(u64),
    ProposalCount,
    RecoveryRequest(Address),
    MemberRole(Symbol, Address),
}

#[contractevent]
pub struct GroupProposedEvent {
    #[topic]
    pub name: Symbol,
    pub proposer: Address,
}

#[contractevent]
pub struct RoleFilledEvent {
    #[topic]
    pub chama_name: Symbol,
    pub address: Address,
}

#[contractevent]
pub struct JoinApprovedEvent {
    #[topic]
    pub chama_name: Symbol,
    pub new_member: Address,
}

#[contractevent]
pub struct DepositedEvent {
    #[topic]
    pub name: Symbol,
    pub amount: i128,
}

#[contractevent]
pub struct WithdrawalProposedEvent {
    #[topic]
    pub chama_name: Symbol,
    pub amount: i128,
}

#[contractevent]
pub struct WithdrawalApprovedEvent {
    #[topic]
    pub chama_name: Symbol,
    pub approver: Address,
}

#[contractevent]
pub struct ProposalExecutedEvent {
    #[topic]
    pub proposal_id: u64,
}

#[contractevent]
pub struct PasskeyRecoveredEvent {
    #[topic]
    pub target_user: Address,
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

fn get_proposal(env: &Env, id: &u64) -> Proposal {
    let key = DataKey::Proposal(*id);
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
    env.storage().persistent().get(&key).unwrap()
}

fn set_proposal(env: &Env, id: &u64, proposal: &Proposal) {
    let key = DataKey::Proposal(*id);
    env.storage().persistent().set(&key, proposal);
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

fn set_member_role(env: &Env, name: &Symbol, member: &Address, role: &Role) {
    let key = DataKey::MemberRole(name.clone(), member.clone());
    env.storage().persistent().set(&key, role);
    env.storage().persistent().extend_ttl(&key, LEDGER_TTL, LEDGER_TTL);
}

fn verify_passkey_signature(env: &Env, user: &Address, signature_payload: &Bytes, signature: &BytesN<64>) {
    let key = DataKey::UserPasskey(user.clone());
    let passkey: PasskeyPublicKey = env.storage().persistent().get(&key).expect("Passkey missing");
    let mut uncompressed_bytes = [0u8; 65];
    uncompressed_bytes[0] = 0x04;
    let x_arr: [u8; 32] = passkey.x.to_array();
    let y_arr: [u8; 32] = passkey.y.to_array();
    uncompressed_bytes[1..33].copy_from_slice(&x_arr);
    uncompressed_bytes[33..65].copy_from_slice(&y_arr);
    let uncompressed = BytesN::<65>::from_array(env, &uncompressed_bytes);
    let payload_hash = env.crypto().sha256(signature_payload);
    env.crypto().secp256r1_verify(&uncompressed, &payload_hash, signature);
}

#[contract]
pub struct ChamaWallet;

#[contractimpl]
impl ChamaWallet {
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
        GroupProposedEvent { name, proposer: address }.publish(&env);
    }

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
        RoleFilledEvent { chama_name, address }.publish(&env);
    }

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

    pub fn approve_join(env: Env, chama_name: Symbol, secretary: Address, new_member: Address) {
        secretary.require_auth();
        let mut chama = get_chama_data(&env, &chama_name);
        if chama.secretary != Some(secretary.clone()) {
            panic!("Only secretary can approve members");
        }
        let index = chama.pending_members.first_index_of(&new_member).expect("No pending request");
        chama.pending_members.remove(index);
        chama.members.push_back(new_member.clone());
        set_member_role(&env, &chama_name, &new_member, &Role::Member);
        set_chama_data(&env, &chama_name, &chama);
        JoinApprovedEvent { chama_name, new_member }.publish(&env);
    }

    pub fn deposit(env: Env, name: Symbol, from: Address, token_id: Address, amount: i128) {
        from.require_auth();
        let mut chama = get_chama_data(&env, &name);
        if chama.status != ChamaStatus::Active {
            panic!("Group is not active");
        }
        if !chama.members.contains(&from) {
            panic!("Not a chama member");
        }
        TokenClient::new(&env, &token_id).transfer(&from, &env.current_contract_address(), &amount);
        chama.balance += amount;
        set_chama_data(&env, &name, &chama);
        DepositedEvent { name, amount }.publish(&env);
    }

    pub fn propose_withdrawal(env: Env, chama_name: Symbol, proposer: Address, amount: i128, recipient: Address) {
        proposer.require_auth();
        let chama = get_chama_data(&env, &chama_name);
        if !chama.members.contains(&proposer) {
            panic!("Not a chama member");
        }
        let proposal = Proposal {
            id: 0,
            proposer: proposer.clone(),
            amount,
            recipient,
            approvals: Vec::new(&env),
            executed: false,
        };
        set_proposal(&env, &0, &proposal);
        WithdrawalProposedEvent { chama_name, amount }.publish(&env);
    }

    pub fn approve_withdrawal(env: Env, chama_name: Symbol, approver: Address, token_id: Address) {
        approver.require_auth();
        let mut proposal = get_proposal(&env, &0);
        let chama = get_chama_data(&env, &chama_name);
        if !chama.members.contains(&approver) {
            panic!("Not a member");
        }
        if proposal.executed {
            panic!("Withdrawal already executed");
        }
        if proposal.approvals.contains(&approver) {
            panic!("Already approved");
        }
        proposal.approvals.push_back(approver.clone());
        if (proposal.approvals.len() as u32) >= APPROVAL_THRESHOLD {
            TokenClient::new(&env, &token_id).transfer(&env.current_contract_address(), &proposal.recipient, &proposal.amount);
            proposal.executed = true;
        }
        set_proposal(&env, &0, &proposal);
        WithdrawalApprovedEvent { chama_name, approver }.publish(&env);
    }

    pub fn get_chama(env: Env, chama_name: Symbol) -> Chama {
        get_chama_data(&env, &chama_name)
    }

    pub fn get_role(env: Env, chama_name: Symbol, member: Address) -> Option<Role> {
        let key = DataKey::MemberRole(chama_name, member);
        env.storage().persistent().get(&key)
    }

    pub fn register_passkey(env: Env, user: Address, passkey: PasskeyPublicKey) {
        user.require_auth();
        let key = DataKey::UserPasskey(user.clone());
        env.storage().persistent().set(&key, &passkey);
    }

    pub fn execute_proposal(env: Env, proposal_id: u64, token_address: Address) {
        let mut proposal = get_proposal(&env, &proposal_id);
        if proposal.executed {
            panic!("Proposal already executed");
        }
        if (proposal.approvals.len() as u32) < MULTISIG_THRESHOLD {
            panic!("Not enough approvals");
        }
        TokenClient::new(&env, &token_address).transfer(&env.current_contract_address(), &proposal.recipient, &proposal.amount);
        proposal.executed = true;
        set_proposal(&env, &proposal_id, &proposal);
        ProposalExecutedEvent { proposal_id }.publish(&env);
    }

    pub fn request_passkey_recovery(env: Env, official: Address, target_user: Address, new_passkey: PasskeyPublicKey) {
        official.require_auth();
        let caller = official.clone();
        let role_key = DataKey::MemberRole(Symbol::new(&env, "chama"), caller.clone());
        let role: Option<Role> = env.storage().persistent().get(&role_key);
        match role {
            Some(Role::Chairperson) | Some(Role::Secretary) | Some(Role::Treasurer) => {},
            _ => panic!("Not an authorized official"),
        }
        let mut approvals = Vec::new(&env);
        approvals.push_back(caller.clone());
        let request = RecoveryRequest {
            target_user: target_user.clone(),
            new_passkey,
            approvals,
        };
        env.storage().persistent().set(&DataKey::RecoveryRequest(target_user.clone()), &request);
    }

    pub fn approve_passkey_recovery(env: Env, official: Address, target_user: Address) {
        official.require_auth();
        let caller = official.clone();
        let mut request: RecoveryRequest = env.storage().persistent().get(&DataKey::RecoveryRequest(target_user.clone())).expect("No recovery request");
        if request.approvals.contains(&caller) {
            panic!("Already approved");
        }
        request.approvals.push_back(caller.clone());
        if (request.approvals.len() as u32) >= MULTISIG_THRESHOLD {
            env.storage().persistent().set(&DataKey::UserPasskey(target_user.clone()), &request.new_passkey);
            env.storage().persistent().remove(&DataKey::RecoveryRequest(target_user.clone()));
            PasskeyRecoveredEvent { target_user: target_user.clone() }.publish(&env);
        } else {
            env.storage().persistent().set(&DataKey::RecoveryRequest(target_user.clone()), &request);
        }
    }
}

mod test;