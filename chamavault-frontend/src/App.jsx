import { useState } from "react";
import { getAddress, isConnected, requestAccess } from "@stellar/freighter-api"

const CONTRACT_ID = "CDB76V4HNBC7LIQHEJUIAUHNM4B2GSUJ6RMD6KEIC4YIRMPWXKL663QE";
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
        {page === "deposit" && <Deposit walletAddress={walletAddress} />}
        {page === "propose" && <ProposeWithdrawal walletAddress={walletAddress} />}
        {page === "approve" && <ApproveWithdrawal walletAddress={walletAddress} />}
        {page === "view" && <ViewChama walletAddress={walletAddress} />}
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
        .setTimeout(120)
        .build();

      const prepared = await server.prepareTransaction(tx);
      const { signTransaction } = await import("@stellar/freighter-api");
      const signResult = await signTransaction(prepared.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (signResult.error) throw new Error(signResult.error);
      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET);
      const result = await server.sendTransaction(txToSubmit);
      if (result.status === "ERROR") throw new Error(JSON.stringify(result.errorResult));

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
      setStatus("Error: " + (err?.message || JSON.stringify(err)));
    }
  }
    
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
        .setTimeout(120)
        .build();

      const prepared = await server.prepareTransaction(tx);
      const { signTransaction } = await import("@stellar/freighter-api");
      const signResult = await signTransaction(prepared.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (signResult.error) throw new Error(signResult.error);
      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET);
      const result = await server.sendTransaction(txToSubmit);
      if (result.status === "ERROR") throw new Error(JSON.stringify(result.errorResult));

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
      setStatus("Error: " + (err?.message || JSON.stringify(err)));
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
function Deposit({ walletAddress }) {
  const [chamaName, setChamaName] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const handleDeposit = async () => {
    if (!chamaName) { setStatus("Please enter a chama name"); return; }
    if (!tokenId) { setStatus("Please enter a token contract address"); return; }
    if (!amount || isNaN(amount) || Number(amount) <= 0) { setStatus("Please enter a valid amount"); return; }
    if (!walletAddress) { setStatus("Please connect wallet first"); return; }
    try {
      setStatus("Building transaction...");
      const StellarSdk = await import("@stellar/stellar-sdk");
      const { Contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } = StellarSdk;
      const server = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");
      const { signTransaction } = await import("@stellar/freighter-api");
      const amountInStroops = BigInt(Math.round(Number(amount) * 1e7));

      // Step 1: approve
      const account = await server.getAccount(walletAddress);
      const ledger = await server.getLatestLedger();
      const approveTx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(
          new Contract(tokenId).call(
            "approve",
            new Address(walletAddress).toScVal(),
            new Address(CONTRACT_ID).toScVal(),
            nativeToScVal(amountInStroops, { type: "i128" }),
            nativeToScVal(ledger.sequence + 100, { type: "u32" })
          )
        )
        .setTimeout(120)
        .build();
      const preparedApprove = await server.prepareTransaction(approveTx);
      const approveSign = await signTransaction(preparedApprove.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (approveSign.error) throw new Error(approveSign.error);
      const approveResult = await server.sendTransaction(
        StellarSdk.TransactionBuilder.fromXDR(approveSign.signedTxXdr, Networks.TESTNET)
      );
      if (approveResult.status === "ERROR") throw new Error(JSON.stringify(approveResult.errorResult));

      setStatus("Approving token spend...");
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const c = await server.getTransaction(approveResult.hash);
        if (c.status === "SUCCESS") break;
        if (c.status === "FAILED") throw new Error("Approval failed");
      }

      // Step 2: deposit
      setStatus("Depositing...");
      const freshAccount = await server.getAccount(walletAddress);
      const depositTx = new TransactionBuilder(freshAccount, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(
          new Contract(CONTRACT_ID).call(
            "deposit",
            nativeToScVal(chamaName.replace(/ /g, "_"), { type: "symbol" }),
            new Address(walletAddress).toScVal(),
            new Address(tokenId).toScVal(),
            nativeToScVal(amountInStroops, { type: "i128" })
          )
        )
        .setTimeout(120)
        .build();
      const preparedDeposit = await server.prepareTransaction(depositTx);
      const depositSign = await signTransaction(preparedDeposit.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (depositSign.error) throw new Error(depositSign.error);
      const depositResult = await server.sendTransaction(
        StellarSdk.TransactionBuilder.fromXDR(depositSign.signedTxXdr, Networks.TESTNET)
      );
      if (depositResult.status === "ERROR") throw new Error(JSON.stringify(depositResult.errorResult));

      setStatus("Confirming deposit...");
      let confirmed;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        confirmed = await server.getTransaction(depositResult.hash);
        if (confirmed.status !== "NOT_FOUND") break;
      }
      if (confirmed.status === "SUCCESS") {
        setStatus("Deposit successful! Tx: " + depositResult.hash);
      } else {
        throw new Error("Transaction failed: " + confirmed.status);
      }
    } catch (err) {
      setStatus("Error: " + (err?.message || JSON.stringify(err)));
    }
  };

  return (
    <div>
      <h2>Deposit</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        <label>Chama Name</label>
        <input
          type="text"
          value={chamaName}
          onChange={(e) => setChamaName(e.target.value.replace(/ /g, "_"))}
          placeholder="e.g. Nguruwe_Savings"
        />
        <label>Token Contract Address</label>
        <input
          type="text"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value.trim())}
          placeholder="e.g. CDLZ...XYZ"
        />
        <label>Amount (XLM)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 10"
          min="0"
        />
        <button onClick={handleDeposit}>Deposit</button>
        {status && <p>{status}</p>}
      </div>
    </div>
  );
}
function ProposeWithdrawal({ walletAddress }) {
  const [chamaName, setChamaName] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState("");

  const handlePropose = async () => {
    if (!chamaName) { setStatus("Please enter a chama name"); return; }
    if (!amount || isNaN(amount) || Number(amount) <= 0) { setStatus("Please enter a valid amount"); return; }
    if (!recipient) { setStatus("Please enter a recipient address"); return; }
    if (!walletAddress) { setStatus("Please connect wallet first"); return; }
    try {
      setStatus("Building transaction...");
      const StellarSdk = await import("@stellar/stellar-sdk");
      const { Contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } = StellarSdk;
      const server = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");
      const { signTransaction } = await import("@stellar/freighter-api");
      const amountInStroops = BigInt(Math.round(Number(amount) * 1e7));

      const account = await server.getAccount(walletAddress);
      const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(
          new Contract(CONTRACT_ID).call(
            "propose_withdrawal",
            nativeToScVal(chamaName.replace(/ /g, "_"), { type: "symbol" }),
            new Address(walletAddress).toScVal(),
            nativeToScVal(amountInStroops, { type: "i128" }),
            new Address(recipient).toScVal()
          )
        )
        .setTimeout(120)
        .build();

      const prepared = await server.prepareTransaction(tx);
      const signResult = await signTransaction(prepared.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (signResult.error) throw new Error(signResult.error);
      const result = await server.sendTransaction(
        StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET)
      );
      if (result.status === "ERROR") throw new Error(JSON.stringify(result.errorResult));

      setStatus("Confirming...");
      let confirmed;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        confirmed = await server.getTransaction(result.hash);
        if (confirmed.status !== "NOT_FOUND") break;
      }
      if (confirmed.status === "SUCCESS") {
        setStatus("Withdrawal proposed! Tx: " + result.hash);
      } else {
        throw new Error("Transaction failed: " + confirmed.status);
      }
    } catch (err) {
      setStatus("Error: " + (err?.message || JSON.stringify(err)));
    }
  };

  return (
    <div>
      <h2>Propose Withdrawal</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        <label>Chama Name</label>
        <input type="text" value={chamaName} onChange={(e) => setChamaName(e.target.value.replace(/ /g, "_"))} placeholder="e.g. Nguruwe_Savings" />
        <label>Amount (XLM)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10" min="0" />
        <label>Recipient Address</label>
        <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} placeholder="e.g. GABC...XYZ" />
        <button onClick={handlePropose}>Propose Withdrawal</button>
        {status && <p>{status}</p>}
      </div>
    </div>
  );
}
function ApproveWithdrawal({ walletAddress }) {
  const [chamaName, setChamaName] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [status, setStatus] = useState("");

  const handleApprove = async () => {
    if (!chamaName) { setStatus("Please enter a chama name"); return; }
    if (!tokenId) { setStatus("Please enter a token contract address"); return; }
    if (!walletAddress) { setStatus("Please connect wallet first"); return; }
    try {
      setStatus("Building transaction...");
      const StellarSdk = await import("@stellar/stellar-sdk");
      const { Contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } = StellarSdk;
      const server = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");
      const { signTransaction } = await import("@stellar/freighter-api");

      const account = await server.getAccount(walletAddress);
      const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: Networks.TESTNET })
        .addOperation(
          new Contract(CONTRACT_ID).call(
            "approve_withdrawal",
            nativeToScVal(chamaName.replace(/ /g, "_"), { type: "symbol" }),
            new Address(walletAddress).toScVal(),
            new Address(tokenId).toScVal()
          )
        )
        .setTimeout(60)
        .build();

      const prepared = await server.prepareTransaction(tx);
      const signResult = await signTransaction(prepared.toXDR(), { networkPassphrase: Networks.TESTNET });
      if (signResult.error) throw new Error(signResult.error);
      const result = await server.sendTransaction(
        StellarSdk.TransactionBuilder.fromXDR(signResult.signedTxXdr, Networks.TESTNET)
      );
      if (result.status === "ERROR") throw new Error(JSON.stringify(result.errorResult));

      setStatus("Confirming...");
      let confirmed;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        confirmed = await server.getTransaction(result.hash);
        if (confirmed.status !== "NOT_FOUND") break;
      }
      if (confirmed.status === "SUCCESS") {
        setStatus("Approval submitted! Tx: " + result.hash);
      } else {
        throw new Error("Transaction failed: " + confirmed.status);
      }
    } catch (err) {
      setStatus("Error: " + (err?.message || JSON.stringify(err)));
    }
  };

  return (
    <div>
      <h2>Approve Withdrawal</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        <label>Chama Name</label>
        <input type="text" value={chamaName} onChange={(e) => setChamaName(e.target.value.replace(/ /g, "_"))} placeholder="e.g. Nguruwe_Savings" />
        <label>Token Contract Address</label>
        <input type="text" value={tokenId} onChange={(e) => setTokenId(e.target.value.trim())} placeholder="e.g. CDLZ...XYZ" />
        <button onClick={handleApprove}>Approve Withdrawal</button>
        {status && <p>{status}</p>}
      </div>
    </div>
  );
}
function ViewChama({ walletAddress }) {
  const [chamaName, setChamaName] = useState("");
  const [chama, setChama] = useState(null);
  const [status, setStatus] = useState("");

  const handleView = async () => {
    if (!chamaName) { setStatus("Please enter a chama name"); return; }
    if (!walletAddress) { setStatus("Please connect wallet first"); return; }
    try {
      setStatus("Fetching...");
      const StellarSdk = await import("@stellar/stellar-sdk");
      const { Contract, nativeToScVal, scValToNative, rpc, Account, TransactionBuilder, Networks } = StellarSdk;
      const server = new rpc.Server("https://soroban-testnet.stellar.org");

      const result = await server.simulateTransaction(
        new TransactionBuilder(
          new Account(walletAddress, "0"),
          { fee: "100", networkPassphrase: Networks.TESTNET }
        )
          .addOperation(
            new Contract(CONTRACT_ID).call(
              "get_chama",
              nativeToScVal(chamaName.replace(/ /g, "_"), { type: "symbol" })
            )
          )
          .setTimeout(120)
          .build()
      );

      if (rpc.Api.isSimulationError(result)) throw new Error(result.error);
      const data = scValToNative(result.result.retval);
      setChama(data);
      setStatus("");
    } catch (err) {
      setStatus("Error: " + (err?.message || JSON.stringify(err)));
      setChama(null);
    }
  };

  return (
    <div>
      <h2>View Chama</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "300px" }}>
        <label>Chama Name</label>
        <input type="text" value={chamaName} onChange={(e) => setChamaName(e.target.value.replace(/ /g, "_"))} placeholder="e.g. Nguruwe_Savings" />
        <button onClick={handleView}>View</button>
        {status && <p>{status}</p>}
      </div>
      {chama && (
        <div style={{ marginTop: "20px" }}>
          <p><strong>Name:</strong> {chama.name}</p>
          <p><strong>Admin:</strong> {chama.admin}</p>
          <p><strong>Balance:</strong> {(Number(chama.balance) / 1e7).toFixed(7)} XLM</p>
          <p><strong>Members ({chama.members.length}):</strong></p>
          <ul>{chama.members.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default App;
