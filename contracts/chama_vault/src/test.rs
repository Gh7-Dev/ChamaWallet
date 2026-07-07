#![cfg (test)]
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
fn test_create_chama(){
    let env = Env::default();
    let contract_id = env.register(ChamaVault, ());
    let client = ChamaVaultClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");
    client.create_chama(&name, &admin);
    let chama = client.get_chama(&name);

    assert_eq!(chama.balance,0);
    assert_eq!(chama.admin,admin);
}
#[test]
fn test_add_member(){
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ChamaVault,());
    let client = ChamaVaultClient::new(&env,&contract_id);
    let admin = Address::generate(&env);
    let name = Symbol::new(&env, "TestChama");
    let member=Address::generate(&env);
    client.create_chama(&name,&admin);
    client.add_member(&name, &admin, &member);
    let chama = client.get_chama(&name);

    assert!(chama.members.contains(&member));
}


