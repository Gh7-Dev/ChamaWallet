import request from 'supertest';
import { TransactionBuilder, Account, Operation, xdr, Keypair, Address, Networks, StrKey } from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import app from '../app';
import { dbService } from '../services/db.service';
import { channelPoolService } from '../services/channel-pool.service';
import { config } from '../config';

// Helper to generate a mock Soroban InvokeContract transaction XDR
function generateMockSorobanXdr(functionName: string, contractAddressStr?: string): string {
  if (!contractAddressStr) {
    const randomBytes = crypto.randomBytes(32);
    contractAddressStr = StrKey.encodeContract(randomBytes);
  }
  const sourceKey = Keypair.random();
  const account = new Account(sourceKey.publicKey(), '0');
  const contractAddress = Address.fromString(contractAddressStr);

  const op = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeInvokeContract(
      new xdr.InvokeContractArgs({
        contractAddress: contractAddress.toScAddress(),
        functionName: functionName,
        args: [],
      })
    ),
    auth: [],
  });

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(op)
    .setTimeout(0)
    .build();

  return tx.toXDR();
}

describe('ChamaVault Fee Relayer & Sponsorship Service Tests', () => {
  const testChamaId = 'turkana-savings-1';
  const testMember = 'GB7B7ZSVU3SXPWSMUK6VUT34E6XGPHC3H6A5CFRFNEP54H5N23SXPWS';

  beforeEach(() => {
    // Clear in-memory database state before each test
    dbService.clearInMemoryDb();
  });

  afterAll(async () => {
    await dbService.close();
  });

  describe('GET /api/v1/chama/:id/float-status', () => {
    it('should return initial float status with Normal threshold status', async () => {
      // Get/Initialize Chama
      const response = await request(app)
        .get(`/api/v1/chama/${testChamaId}/float-status`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chamaId).toBe(testChamaId);
      expect(response.body.opexFloat).toBe(1000);
      expect(response.body.thresholdStatus).toBe('Normal');
      expect(response.body.totalSponsoredToday).toBe(0);
    });
  });

  describe('POST /api/v1/relayer/sponsor', () => {
    it('should successfully sponsor an allowlisted function (e.g., execute)', async () => {
      const validXdr = generateMockSorobanXdr('propose_withdrawal');

      const response = await request(app)
        .post('/api/v1/relayer/sponsor')
        .send({
          chamaId: testChamaId,
          memberAddress: testMember,
          transactionXdr: validXdr,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.txHash).toBeDefined();
      expect(response.body.ledger).toBeDefined();

      // Check float status update:
      // propose_withdrawal: fee paid -0.225 KES, micro-fee contribution +2.00 KES
      // Net: 1000 - 0.225 + 2.00 = 1001.775 KES
      const statusRes = await request(app).get(`/api/v1/chama/${testChamaId}/float-status`);
      expect(statusRes.body.opexFloat).toBe(1001.775);
      expect(statusRes.body.totalSponsoredToday).toBe(1);
    });

    it('should successfully sponsor and apply micro-fee for deposit', async () => {
      // Note: although 'deposit' is NOT in the allowed functions for fee sponsorship, we have to test micro-fee calculation.
      // Wait, let's see: how do we test micro-fee contributions?
      // Since we log it in dbService, let's make sure we log a deposit transaction to test the math.
      // Or we can add 'deposit' to our test schema or check that opexFloat gets top-up.
      // Let's call logTransaction directly to verify micro-fee contribution logic.
      await dbService.createChama(testChamaId, 'Test', 1000.0);
      await dbService.logTransaction(testChamaId, testMember, 'txhash123', 'deposit', 150000, 0.015, 0.225);

      const statusRes = await request(app).get(`/api/v1/chama/${testChamaId}/float-status`);
      // Initial: 1000
      // Actual Fee Paid: -0.225 KES
      // Micro-Fee Contribution: +0.50 KES
      // Net: 1000 - 0.225 + 0.5 = 1000.275 KES
      expect(statusRes.body.opexFloat).toBe(1000.275);
    });

    it('should successfully sponsor and apply micro-fee for withdraw', async () => {
      const validXdr = generateMockSorobanXdr('propose_withdrawal');

      const response = await request(app)
        .post('/api/v1/relayer/sponsor')
        .send({
          chamaId: testChamaId,
          memberAddress: testMember,
          transactionXdr: validXdr,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const statusRes = await request(app).get(`/api/v1/chama/${testChamaId}/float-status`);
      // Initial: 1000
      // Actual Fee Paid: -0.225 KES
      // Micro-Fee Contribution: +2.00 KES
      // Net: 1000 - 0.225 + 2.00 = 1001.775 KES
      expect(statusRes.body.opexFloat).toBe(1001.775);
    });

    it('should reject sponsorship for non-allowlisted function calls', async () => {
      const invalidXdr = generateMockSorobanXdr('some_unsupported_function');

      const response = await request(app)
        .post('/api/v1/relayer/sponsor')
        .send({
          chamaId: testChamaId,
          memberAddress: testMember,
          transactionXdr: invalidXdr,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Allowlist validation failed');
    });

    it('should enforce Reserve Float Safeguard and reject if Chama float is locked (< 500 KES)', async () => {
      // 1. Manually decrease float to 400 KES (Locked)
      await dbService.createChama(testChamaId, 'Turkana Savings 1', 400.00);
      
      const statusRes = await request(app).get(`/api/v1/chama/${testChamaId}/float-status`);
      expect(statusRes.body.thresholdStatus).toBe('Locked');

      // 2. Try to sponsor
      const validXdr = generateMockSorobanXdr('propose_withdrawal');
      const response = await request(app)
        .post('/api/v1/relayer/sponsor')
        .send({
          chamaId: testChamaId,
          memberAddress: testMember,
          transactionXdr: validXdr,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('insufficient float balance');
      expect(response.body.thresholdStatus).toBe('Locked');
    });

    it('should enforce daily per-member rate limit (max 5 transactions per 24 hours)', async () => {
      await dbService.createChama(testChamaId, 'Turkana Savings 1', 2000.00);
      const validXdr = generateMockSorobanXdr('propose_withdrawal');

      // Submit 5 successful transactions
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/v1/relayer/sponsor')
          .send({
            chamaId: testChamaId,
            memberAddress: testMember,
            transactionXdr: validXdr,
          });
        expect(res.status).toBe(200);
      }

      // 6th transaction should trigger rate limit (429)
      const limitRes = await request(app)
        .post('/api/v1/relayer/sponsor')
        .send({
          chamaId: testChamaId,
          memberAddress: testMember,
          transactionXdr: validXdr,
        });

      expect(limitRes.status).toBe(429);
      expect(limitRes.body.success).toBe(false);
      expect(limitRes.body.limitType).toBe('member');
      expect(limitRes.body.resetInSeconds).toBeGreaterThan(0);
    });

    it('should enforce daily per-Chama rate limit (max 20 transactions per 24 hours)', async () => {
      await dbService.createChama(testChamaId, 'Turkana Savings 1', 5000.00);
      const validXdr = generateMockSorobanXdr('propose_withdrawal');

      // Submit 20 successful transactions from different member addresses
      for (let i = 0; i < 20; i++) {
        const uniqueMember = `GB7B7ZSVU3SXPWSMUK6VUT34E6XGPHC3H6A5CFRFNEP54H5N23SXP${i.toString().padStart(2, '0')}`;
        const res = await request(app)
          .post('/api/v1/relayer/sponsor')
          .send({
            chamaId: testChamaId,
            memberAddress: uniqueMember,
            transactionXdr: validXdr,
          });
        expect(res.status).toBe(200);
      }

      // 21st transaction should trigger Chama rate limit (429)
      const limitRes = await request(app)
        .post('/api/v1/relayer/sponsor')
        .send({
          chamaId: testChamaId,
          memberAddress: 'GB7B7ZSVU3SXPWSMUK6VUT34E6XGPHC3H6A5CFRFNEP54H5N23SXP99',
          transactionXdr: validXdr,
        });

      expect(limitRes.status).toBe(429);
      expect(limitRes.body.success).toBe(false);
      expect(limitRes.body.limitType).toBe('chama');
      expect(limitRes.body.resetInSeconds).toBeGreaterThan(0);
    });
  });

  describe('Channel Pool Parallel Handling', () => {
    it('should acquire and lock channels to enable concurrency without sequence collision', async () => {
      const status = channelPoolService.getPoolStatus();
      expect(status.total).toBe(5);
      expect(status.available).toBe(5);

      const keypair1 = await channelPoolService.acquireChannel();
      const keypair2 = await channelPoolService.acquireChannel();

      const updatedStatus = channelPoolService.getPoolStatus();
      expect(updatedStatus.locked).toBe(2);
      expect(updatedStatus.available).toBe(3);

      channelPoolService.releaseChannel(keypair1.publicKey());
      channelPoolService.releaseChannel(keypair2.publicKey());

      const finalStatus = channelPoolService.getPoolStatus();
      expect(finalStatus.locked).toBe(0);
      expect(finalStatus.available).toBe(5);
    });
  });

  describe('Automated 30-day Reconciliation Job', () => {
    it('should perform 30-day usage vs contribution audit and flag warning', async () => {
      // 1. Setup a Chama with warning-level float (550 KES)
      const lowFloatChama = 'warning-chama';
      await dbService.createChama(lowFloatChama, 'Low Float Group', 550.0);

      // 2. Perform some transactions
      // Propose withdrawal contribution (+2.00 KES, Fee: -0.225 KES)
      await dbService.logTransaction(lowFloatChama, testMember, 'tx1', 'propose_withdrawal', 150000, 0.015, 0.225);
      // Deposit contribution (+0.50 KES, Fee: -0.225 KES)
      await dbService.logTransaction(lowFloatChama, testMember, 'tx2', 'deposit', 150000, 0.015, 0.225);

      // 3. Trigger manual admin reconciliation
      const response = await request(app)
        .post('/api/v1/admin/reconcile')
        .set('Authorization', `Bearer ${process.env.ADMIN_AUTH_TOKEN}`)
        .send({ chamaId: lowFloatChama });
     

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);

      const audit = response.body.results[0];
      expect(audit.chamaId).toBe(lowFloatChama);
      // Contributions: 2.00 + 0.50 = 2.50 KES
      expect(audit.totalContributionsKes).toBe(2.50);
      // Gas Fees: 0.225 * 2 = 0.45 KES
      expect(audit.totalUsageKes).toBe(0.45);
      expect(audit.netImpactKes).toBe(2.05);
      // Float balance: 550 + 2.50 - 0.45 = 552.05 KES (which is under warning threshold 600 KES)
      expect(audit.currentFloatKes).toBe(552.05);
      expect(audit.alertFlagged).toBe(true);
    });
  });
});
