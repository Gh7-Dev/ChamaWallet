#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env};

#[test]
fn test_propose_chama() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let chairperson = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Chairperson, &chairperson);
    let chama = client.get_chama(&name);

    assert_eq!(chama.balance, 0);
    assert_eq!(chama.chairperson, Some(chairperson.clone()));
    assert_eq!(chama.secretary, None);
    assert_eq!(chama.treasurer, None);
    assert_eq!(chama.status, ChamaStatus::Proposed);
    assert!(chama.members.contains(&chairperson));
    assert_eq!(chama.members.len(), 1);
}

#[test]
fn test_proposer_can_pick_any_role() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let treasurer = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Treasurer, &treasurer);
    let chama = client.get_chama(&name);

    assert_eq!(chama.treasurer, Some(treasurer.clone()));
    assert_eq!(chama.chairperson, None);
}

#[test]
fn test_fill_role_activates_group() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let chairperson = Address::generate(&env);
    let secretary = Address::generate(&env);
    let treasurer = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Chairperson, &chairperson);
    client.fill_role(&name, &secretary, &Role::Secretary);

    let chama = client.get_chama(&name);
    assert_eq!(chama.status, ChamaStatus::Proposed);
    assert_eq!(chama.secretary, Some(secretary.clone()));

    client.fill_role(&name, &treasurer, &Role::Treasurer);

    let chama = client.get_chama(&name);
    assert_eq!(chama.status, ChamaStatus::Active);
    assert_eq!(chama.members.len(), 3);
    assert_eq!(client.get_role(&name, &treasurer), Some(Role::Treasurer));
}

#[test]
#[should_panic(expected = "Secretary already filled")]
fn test_fill_role_rejects_taken_seat() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let chairperson = Address::generate(&env);
    let secretary1 = Address::generate(&env);
    let secretary2 = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Chairperson, &chairperson);
    client.fill_role(&name, &secretary1, &Role::Secretary);
    client.fill_role(&name, &secretary2, &Role::Secretary);
}

#[test]
#[should_panic(expected = "Group is not yet active")]
fn test_request_join_before_active_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let chairperson = Address::generate(&env);
    let requester = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Chairperson, &chairperson);
    client.request_join(&name, &requester);
}

#[test]
fn test_request_and_approve_join() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let chairperson = Address::generate(&env);
    let secretary = Address::generate(&env);
    let treasurer = Address::generate(&env);
    let requester = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Chairperson, &chairperson);
    client.fill_role(&name, &secretary, &Role::Secretary);
    client.fill_role(&name, &treasurer, &Role::Treasurer);

    client.request_join(&name, &requester);
    let chama = client.get_chama(&name);
    assert!(chama.pending_members.contains(&requester));
    assert!(!chama.members.contains(&requester));

    client.approve_join(&name, &secretary, &requester);
    let chama = client.get_chama(&name);
    assert!(!chama.pending_members.contains(&requester));
    assert!(chama.members.contains(&requester));
    assert_eq!(client.get_role(&name, &requester), Some(Role::Member));
}

#[test]
#[should_panic(expected = "Only secretary can approve members")]
fn test_approve_join_requires_secretary() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaWallet, ());
    let client = ChamaWalletClient::new(&env, &contract_id);
    let chairperson = Address::generate(&env);
    let secretary = Address::generate(&env);
    let treasurer = Address::generate(&env);
    let requester = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");

    client.propose_chama(&name, &Role::Chairperson, &chairperson);
    client.fill_role(&name, &secretary, &Role::Secretary);
    client.fill_role(&name, &treasurer, &Role::Treasurer);
    client.request_join(&name, &requester);
    client.approve_join(&name, &treasurer, &requester);
}
