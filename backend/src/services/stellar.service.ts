import {
  TransactionBuilder,
  Networks,
  Keypair,
  Transaction,
  FeeBumpTransaction,
  Address,
  xdr,
  rpc,
} from '@stellar/stellar-sdk';
import { config } from '../config';
import { channelPoolService } from './channel-pool.service';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 60; // ~120s

export interface DecodedTxInfo {
  contractId: string;
  functionName: string;
  sourceAccount: string;
}

class StellarService {
  private networkPassphrase: string;
  private allowedFunctions = new Set([
    'propose_chama',
    'fill_role',
    'request_join',
    'approve_join',
    'deposit',
    'propose_withdrawal',
    'approve_withdrawal',
  ]);

  private server: rpc.Server;

  constructor() {
    this.networkPassphrase = config.stellarNetwork === 'MAINNET' ? Networks.PUBLIC : Networks.TESTNET;
    this.server = new rpc.Server(config.stellarRpcUrl);
  }

  /**
   * Decodes an XDR transaction envelope and extracts the target contract ID, function name, and source account.
   */
  public decodeAndValidateXdr(transactionXdr: string): DecodedTxInfo {
    try {
      const genericTx = TransactionBuilder.fromXDR(transactionXdr, this.networkPassphrase);
      
      let tx: Transaction;
      if (genericTx instanceof FeeBumpTransaction) {
        tx = genericTx.innerTransaction;
      } else if (genericTx instanceof Transaction) {
        tx = genericTx;
      } else {
        throw new Error('Unsupported transaction envelope type');
      }

      const sourceAccount = tx.source;
      let contractId = '';
      let functionName = '';

      // Parse operations to find the InvokeHostFunction operation
      for (const op of tx.operations) {
        if (op.type === 'invokeHostFunction') {
          const hostFn = (op as any).func;
          if (!hostFn) continue;

          const fnSwitch = hostFn.switch();

          // Check if it's an invokeContract call
          if (fnSwitch === xdr.HostFunctionType.hostFunctionTypeInvokeContract() || fnSwitch.value === xdr.HostFunctionType.hostFunctionTypeInvokeContract().value) {
            const invokeArgs = hostFn.invokeContract();
            const scAddress = invokeArgs.contractAddress();
            contractId = Address.fromScAddress(scAddress).toString();
            functionName = invokeArgs.functionName().toString();
            break;
          } 
          // Check if it's a createContract call
          else if (
            fnSwitch === xdr.HostFunctionType.hostFunctionTypeCreateContract() || 
            fnSwitch.value === xdr.HostFunctionType.hostFunctionTypeCreateContract().value
          ) {
            functionName = 'deploy_account';
            contractId = 'FACTORY';
            break;
          }
        }
      }

      if (!functionName) {
        throw new Error('No Soroban host function invocation found in transaction');
      }

      // Verify against function allowlist
      if (!this.allowedFunctions.has(functionName)) {
        throw new Error(`Function '${functionName}' is not in the allowed sponsorship list`);
      }

      return {
        contractId,
        functionName,
        sourceAccount
      };
    } catch (err: any) {
      console.error('XDR Parsing / Validation Error:', err.message);
      throw err;
    }
  }

  /**
   * Performs Soroban pre-flight simulation via RPC to estimate fees.
   * Falls back to a safe conservative estimate if simulation fails.
   */
  public async simulateAndEstimateFees(transactionXdr: string): Promise<{
    minFeeStroops: number;
    feeXlm: number;
    feeKes: number;
    simulatedSuccess: boolean;
  }> {
    // Test/in-memory mode: return deterministic mock so unit tests stay fast
    if (config.nodeEnv === 'test' || config.useInMemoryDb) {
      const minFeeStroops = 150000;
      const feeXlm = minFeeStroops / 10_000_000;
      return { minFeeStroops, feeXlm, feeKes: feeXlm * config.kesPerXlm, simulatedSuccess: true };
    }

    try {
      const tx = TransactionBuilder.fromXDR(transactionXdr, this.networkPassphrase);
      if (!(tx instanceof Transaction)) {
        throw new Error('Cannot simulate a fee-bump envelope');
      }
      const simResult = await this.server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(simResult)) {
        throw new Error(`Simulation error: ${simResult.error}`);
      }
      const minFeeStroops = parseInt((simResult as rpc.Api.SimulateTransactionSuccessResponse).minResourceFee, 10);
      const feeXlm = minFeeStroops / 10_000_000;
      return { minFeeStroops, feeXlm, feeKes: feeXlm * config.kesPerXlm, simulatedSuccess: true };
    } catch (err) {
      console.warn('[StellarService] RPC simulation failed, using conservative fallback:', err);
      const minFeeStroops = 200_000;
      const feeXlm = minFeeStroops / 10_000_000;
      return { minFeeStroops, feeXlm, feeKes: feeXlm * config.kesPerXlm, simulatedSuccess: false };
    }
  }

  /**
   * Build Fee-Bump Transaction and sign it with the Sponsoring Relayer keypair
   */
  public buildFeeBumpEnvelope(
    innerTxXdr: string,
    sponsorKeypair: Keypair,
    feeStroops: number
  ): string {
    const innerTx = TransactionBuilder.fromXDR(innerTxXdr, this.networkPassphrase);
    
    if (!(innerTx instanceof Transaction)) {
      throw new Error('Inner transaction must be a standard Transaction for Fee-Bumping');
    }

    // Dynamically calculate fee: must exceed innerTx fee + safety threshold, with floor of 100,000 stroops
    const innerFee = parseInt((innerTx as any).fee || '0', 10) || 0;
    const feeToUse = Math.max(innerFee + 1000, 100000).toString();

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,
      feeToUse,
      innerTx,
      this.networkPassphrase
    );

    // Sign the fee bump transaction
    feeBumpTx.sign(sponsorKeypair);

    return feeBumpTx.toXDR();
  }

  /**
   * Submits a signed fee-bump XDR to the Stellar RPC and polls until
   * the transaction reaches SUCCESS or FAILED status.
   */
  public async submitTransaction(
    feeBumpXdr: string,
    _channelKeypair: Keypair
  ): Promise<{ txHash: string; ledger: number }> {
    // Test/in-memory mode: skip real network call
    if (config.nodeEnv === 'test' || config.useInMemoryDb) {
      return { txHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', ledger: 1012345 };
    }

    const feeBumpTx = TransactionBuilder.fromXDR(feeBumpXdr, this.networkPassphrase);
    const sendResult = await this.server.sendTransaction(feeBumpTx);

    if (sendResult.status === 'ERROR') {
      throw new Error(`Transaction submission failed: ${JSON.stringify(sendResult.errorResult)}`);
    }

    const hash = sendResult.hash;

    // Poll until confirmed or timeout
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const result = await this.server.getTransaction(hash);
      if (result.status === 'SUCCESS') {
        return { txHash: hash, ledger: (result as any).ledger ?? 0 };
      }
      if (result.status === 'FAILED') {
        throw new Error(`Transaction failed on-chain: ${hash}`);
      }
    }

    throw new Error(`Transaction confirmation timed out: ${hash}`);
  }

  /**
   * Full sponsorship flow coordinating channels and fees
   */
  public async processSponsorship(
    transactionXdr: string
  ): Promise<{ txHash: string; ledger: number; feeStroops: number; feeXlm: number; feeKes: number; functionName: string }> {
    // 1. Decode and Validate allowlist
    const { functionName } = this.decodeAndValidateXdr(transactionXdr);

    // 2. Simulate transaction to find required gas fee
    const { minFeeStroops, feeXlm, feeKes } = await this.simulateAndEstimateFees(transactionXdr);

    // 3. Select an available Channel Account from the pool
    const channelKeypair = await channelPoolService.acquireChannel();

    try {
      // 4. Construct and sign the Fee-Bump transaction
      const sponsorSecret = config.relayerSecret;
      if(!sponsorSecret){
        throw new Error("RELAYER_SECRET is not configured");
      }
      const sponsorKeypair = Keypair.fromSecret(sponsorSecret);

      const feeBumpXdr = this.buildFeeBumpEnvelope(transactionXdr, sponsorKeypair, minFeeStroops);

      // 5. Submit to Stellar
      const { txHash, ledger } = await this.submitTransaction(feeBumpXdr, channelKeypair);

      return {
        txHash,
        ledger,
        feeStroops: minFeeStroops,
        feeXlm,
        feeKes,
        functionName
      };
    } finally {
      // Always release the channel account back to the pool
      channelPoolService.releaseChannel(channelKeypair.publicKey());
    }
  }
}

export const stellarService = new StellarService();
export default stellarService;
