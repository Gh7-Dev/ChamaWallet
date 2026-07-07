#![no_std]
#[allow(deprecated)]
use soroban_sdk::{contract, contractimpl,contracttype,Address, Env, Symbol, Vec};
use soroban_sdk::token::Client as TokenClient;
const APPROVAL_THRESHOLD: u32=2;

#[contracttype]
pub struct Chama {
    name: Symbol,
    admin : Address,
    balance : i128,
    members: Vec<Address>,
}
#[contracttype]
pub struct Proposal{
    pub amount:i128,
    pub recipient: Address,
    pub approvals:u32, //tracks how many mmembers have been approved
    pub executed:bool, // prevents approval of a member twice
}
#[contracttype]
enum DataKey{
    ChamaData(Symbol),
    Proposal(Symbol)
}

#[contract]
pub struct ChamaVault;

#[contractimpl]
impl ChamaVault{
   pub  fn create_chama(env: Env,name:Symbol,admin:Address,){
    let chama = Chama{name:name.clone(),admin: admin.clone(),balance: 0, members:Vec::new(&env)};
    env.storage().persistent().set(&DataKey::ChamaData(name.clone()), &chama); 
    env.events().publish((Symbol::new(&env, "created"), name.clone()), admin)
   }

   pub fn add_member(env:Env, name:Symbol, admin:Address, new_member: Address){
    admin.require_auth();
    let mut chama:Chama = env.storage().persistent().get(&DataKey::ChamaData(name.clone())).unwrap();
    chama.members.push_back(new_member);
    env.storage().persistent().set(&DataKey::ChamaData(name), &chama);
   }

   pub fn deposit(env:Env, name:Symbol, from:Address, token_id:Address, amount:i128 ){
    from.require_auth();
    let mut chama:Chama = env.storage().persistent().get(&DataKey::ChamaData(name.clone())).unwrap();
    TokenClient::new(&env,&token_id).transfer(&from, &env.current_contract_address(), &amount);
    chama.balance += amount;
    env.storage().persistent().set(&DataKey::ChamaData(name.clone()), &chama);
    env.events().publish((Symbol::new(&env,"deposited"),name), &amount)
   }

   pub fn propose_withdrawal(env: Env, chama_name: Symbol, proposer: Address, amount:i128, recipient: Address){
    proposer.require_auth();
    let chama:Chama = env.storage().persistent().get(&DataKey::ChamaData(chama_name.clone())).unwrap();
    if !chama.members.contains(&proposer){
        panic!("Not a chama member");
    }
    let proposal =Proposal{amount, recipient, approvals:0 , executed: false};
    env.storage().persistent().set(&DataKey::Proposal(chama_name.clone()), &proposal);
    env.events().publish((Symbol::new(&env, "proposed"), &chama_name),&amount)
   }

   pub fn approve_withdrawal(env:Env, chama_name: Symbol, approver:Address, token_id:Address ){
    let mut proposal:Proposal = env.storage().persistent().get(&DataKey::Proposal(chama_name.clone())).unwrap();
    let chama:Chama = env.storage().persistent().get(&DataKey::ChamaData(chama_name.clone())).unwrap();
    if !chama.members.contains(&approver){
        panic!("Not a member");
    }
    if proposal.executed == true{
        panic!("Withdrawal already approved");
    }
    proposal.approvals += 1;
    if proposal.approvals >= APPROVAL_THRESHOLD{
        TokenClient::new(&env, &token_id).transfer(&env.current_contract_address(), &proposal.recipient, &proposal.amount);
        proposal.executed = true;
    }
    env.storage().persistent().set(&DataKey::Proposal(chama_name.clone()), &proposal);
    env.events().publish((Symbol::new(&env, "Approved"), chama_name), &approver);
   }
   pub fn get_chama(env:Env, chama_name: Symbol)->Chama{
    env.storage().persistent().get(&DataKey::ChamaData(chama_name)).unwrap()
   }
}
 
mod test;
