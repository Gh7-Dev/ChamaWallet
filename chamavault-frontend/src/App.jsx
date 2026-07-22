import { useState } from "react";
import { getAddress, isConnected, requestAccess } from "@stellar/freighter-api"

const CONTRACT_ID = "CB4IQW7N33KD7WKX53WRGOXGIONRTQLRUUH7CLSPHPY44I2632T45KOV";
const NETWORK = "TESTNET";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const connectWallet = async () =>{
    try {
      const accessObj = await requestAccess();
      if (accessObj.error) throw new Error(accessObj.error);
      const { address } = await getAddress();
      setWalletAddress(address);
    } catch(err) {
      console.error("Wallet connection failed", err);
      alert("Could not connect wallet. Make sure Freighter is installed and unlocked");
    }
  };
  const [page, setPage] = useState("home");

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h1>ChamaVault</h1>
      <p>Transparent group treasury on Stellar</p>
        <div style ={{ marginBottom: "10px" }}>
          {walletAddress
            ? <p>Connected: {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}</p>
            : <button onClick={connectWallet}>Connect Wallet</button>            
          }
        </div>

      <nav style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setPage("create")}>Create Chama</button>
        <button onClick={() => setPage("addMember")}>Add Member</button>
        <button onClick={() => setPage("deposit")}>Deposit</button>
        <button onClick={() => setPage("propose")}>Propose Withdrawal</button>
        <button onClick={() => setPage("approve")}>Approve</button>
        <button onClick={() => setPage("view")}>View Chama</button>
      </nav>
      <div>
        {page === "home" && <p>Select an action above.</p>}
        {page === "create" && <CreateChama walletAddress={walletAddress} />}
        {page === "addMember" && <AddMember walletAddress={walletAddress} />}
        {page === "deposit" && <Deposit />}
        {page === "propose" && <ProposeWithdrawal />}
        {page === "approve" && <ApproveWithdrawal />}
        {page === "view" && <ViewChama />}
      </div>
    </div>
  );
}
function CreateChama({walletAddress}) {
  const [chamaName, setChamaName] = useState("");
  const [status, setStatus] = useState("");

  const handleCreate = async () => {
    if (!chamaName) {
      setStatus("Please enter a chama name");
      return;
    }
    if (!walletAddress){
      setStatus("Please connect wallet first");
      return;
    }
    try {
      setStatus("Building transaction...");

      const StellarSdk = await import("@stellar/stellar-sdk");
      const { Contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } = StellarSdk;
      const server = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");

      const account = await server.getAccount(walletAddress);
      const contract = new Contract(CONTRACT_ID);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "create_chama",
            nativeToScVal(chamaName.replace(/ /g, "_"), { type: "symbol" }),
            new Address(walletAddress).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      const prepared = await server.prepareTransaction(tx);
      const { signTransaction } = await import("@stellar/freighter-api");
      const signResult = await signTransaction(prepared.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (signResult.error) throw new Error(signResult.error);
      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET);
      const result = await server.sendTransaction(txToSubmit);
      if (result.status === "ERROR") throw new Error(result.errorResult);

      setStatus("Confirming transaction...");
      let confirmed;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        confirmed = await server.getTransaction(result.hash);
        if (confirmed.status !== "NOT_FOUND") break;
      }
      if (confirmed.status === "SUCCESS") {
        setStatus("Chama created! Tx: " + result.hash);
      } else {
        throw new Error("Transaction failed: " + confirmed.status);
      }
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  }
    //setStatus("Connecting to Freighter wallet...");
    // contract call will go here

  return (
    <div>
      <h2>Create Chama</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        <label>Chama Name</label>
        <input
          type="text"
          value={chamaName}
          onChange={(e) => setChamaName(e.target.value.replace(/ /g, "_"))}
          placeholder="e.g. Nguruwe Savings"
        />
        <button onClick={handleCreate}>Create Chama</button>
        {status && <p>{status}</p>}
      </div>
    </div>
  );
}
function AddMember({ walletAddress }) {
  const [chamaName, setChamaName] = useState("");
  const [newMember, setNewMember] = useState("");
  const [status, setStatus] = useState("");

  const handleAddMember = async () => {
    if (!chamaName) { setStatus("Please enter a chama name"); return; }
    if (!newMember) { setStatus("Please enter a member address"); return; }
    if (!walletAddress) { setStatus("Please connect wallet first"); return; }
    try {
      setStatus("Building transaction...");
      const StellarSdk = await import("@stellar/stellar-sdk");
      const { Contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } = StellarSdk;
      const server = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");

      const account = await server.getAccount(walletAddress);
      const contract = new Contract(CONTRACT_ID);

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "add_member",
            nativeToScVal(chamaName.replace(/ /g, "_"), { type: "symbol" }),
            new Address(walletAddress).toScVal(),
            new Address(newMember).toScVal()
          )
        )
        .setTimeout(30)
        .build();

      const prepared = await server.prepareTransaction(tx);
      const { signTransaction } = await import("@stellar/freighter-api");
      const signResult = await signTransaction(prepared.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (signResult.error) throw new Error(signResult.error);
      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET);
      const result = await server.sendTransaction(txToSubmit);
      if (result.status === "ERROR") throw new Error(result.errorResult);

      setStatus("Confirming transaction...");
      let confirmed;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        confirmed = await server.getTransaction(result.hash);
        if (confirmed.status !== "NOT_FOUND") break;
      }
      if (confirmed.status === "SUCCESS") {
        setStatus("Member added! Tx: " + result.hash);
      } else {
        throw new Error("Transaction failed: " + confirmed.status);
      }
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div>
      <h2>Add Member</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        <label>Chama Name</label>
        <input
          type="text"
          value={chamaName}
          onChange={(e) => setChamaName(e.target.value.replace(/ /g, "_"))}
          placeholder="e.g. Nguruwe_Savings"
        />
        <label>New Member Address</label>
        <input
          type="text"
          value={newMember}
          onChange={(e) => setNewMember(e.target.value.trim())}
          placeholder="e.g. GABC...XYZ"
        />
        <button onClick={handleAddMember}>Add Member</button>
        {status && <p>{status}</p>}
      </div>
    </div>
  );
}
function Deposit() {
  return <div><h2>Deposit</h2><p>Form coming soon</p></div>;
}
function ProposeWithdrawal() {
  return <div><h2>Propose Withdrawal</h2><p>Form coming soon</p></div>;
}
function ApproveWithdrawal() {
  return <div><h2>Approve Withdrawal</h2><p>Form coming soon</p></div>;
}
function ViewChama() {
  return <div><h2>View Chama</h2><p>Form coming soon</p></div>;
}

export default App;