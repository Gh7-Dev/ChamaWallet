import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { dbService } from './services/db.service';
import { stellarService } from './services/stellar.service';
import { channelPoolService } from './services/channel-pool.service';
import { runAllReconciliations, reconcileChama } from './jobs/reconciliation.job';

const app = express();

/* Standard Middlewares */
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// CSRF note: this is a stateless JSON API consumed by a browser extension
// (Freighter) — no cookies or sessions are used. All mutating routes require
// either a signed XDR blob (sponsor) or an Authorization: Bearer token
// (admin routes), so CSRF does not apply.

/**
 * Load admin authentication token from environment
 */
const adminAuthToken = process.env.ADMIN_AUTH_TOKEN;

/** Strip newline/carriage-return characters to prevent log injection (CWE-117). */
const sanitizeLog = (s: string): string => String(s).replace(/[\r\n]/g, ' ');

/**
 * Admin authentication middleware
 */
const verifyAdminToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authorization token required' });
    return;
  }
  const token = authHeader.substring(7);
  if (token !== adminAuthToken) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
};

/**
 * GET /api/v1/chama/:id/float-status
 * Returns current OPEX_FLOAT balance, total sponsored transactions today, estimated remaining capacity, and threshold status.
 */
app.get('/api/v1/chama/:id/float-status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const chamaId = req.params.id;
    if (!chamaId) {
      res.status(400).json({ success: false, error: 'Chama ID is required' });
      return;
    }

    const floatRecord = await dbService.getChamaFloat(chamaId);
    const usage = await dbService.getChamaUsage(chamaId);

    // Estimate remaining capacity based on daily limits and remaining balance
    // Average transaction fee is around 0.15 XLM = 2.25 KES (assuming KES_PER_XLM = 15)
const avgTxFeeKes = 0.15 * config.kesPerXlm;
    const remainingBalanceCapacity = Math.max(0, Math.floor((floatRecord.opexFloat - config.minFloatThresholdKes) / avgTxFeeKes));
    const remainingLimitCapacity = Math.max(0, config.maxChamaTxsPer24h - usage.count);
    const estimatedRemainingCapacity = Math.min(remainingBalanceCapacity, remainingLimitCapacity);

    res.json({
      success: true,
      chamaId,
      name: floatRecord.name,
      opexFloat: floatRecord.opexFloat,
      totalSponsoredToday: usage.count,
      estimatedRemainingCapacity,
      thresholdStatus: floatRecord.status, // Normal / Warning / Locked
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v1/relayer/sponsor
 * Sponsors Soroban network fees for an allowlisted transaction
 */
app.post('/api/v1/relayer/sponsor', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { chamaId, memberAddress, transactionXdr } = req.body;

    // 1. Validate payload inputs
    if (!chamaId || !memberAddress || !transactionXdr) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: chamaId, memberAddress, and transactionXdr are required.',
      });
      return;
    }

    // 2. Decode and validate XDR against Function Allowlist FIRST
    let decodedInfo;
    try {
      decodedInfo = stellarService.decodeAndValidateXdr(transactionXdr);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: `Allowlist validation failed: ${err.message}`,
      });
      return;
    }

    // 3. Enforce Reserve Float Safeguard: Check if Chama is Locked (< 500 KES)
    const floatRecord = await dbService.getChamaFloat(chamaId);
    if (floatRecord.status === 'Locked' || floatRecord.opexFloat < config.minFloatThresholdKes) {
      res.status(403).json({
        success: false,
        error: `Sponsorship rejected: Chama '${sanitizeLog(chamaId)}' has insufficient float balance (${floatRecord.opexFloat.toFixed(2)} KES). Minimum required threshold is ${config.minFloatThresholdKes} KES. Please top up.`,
        opexFloat: floatRecord.opexFloat,
        thresholdStatus: 'Locked',
      });
      return;
    }

    // 4. Rate Limiting: Check Per-Member Cap (max 5 tx per 24h)
    const memberUsage = await dbService.getMemberUsage(memberAddress);
    if (memberUsage.count >= config.maxMemberTxsPer24h) {
      const now = Date.now();
      const oldestTxTime = memberUsage.oldestTxTime ? memberUsage.oldestTxTime.getTime() : now;
      const resetInSeconds = Math.max(0, Math.ceil((oldestTxTime + 24 * 60 * 60 * 1000 - now) / 1000));
      
      res.status(429).json({
        success: false,
        error: 'Too Many Requests: Member has reached the daily limit of 5 sponsored transactions.',
        limitType: 'member',
        resetInSeconds,
      });
      return;
    }

    // 5. Rate Limiting: Check Per-Chama Cap (max 20 tx per 24h)
    const chamaUsage = await dbService.getChamaUsage(chamaId);
    if (chamaUsage.count >= config.maxChamaTxsPer24h) {
      const now = Date.now();
      const oldestTxTime = chamaUsage.oldestTxTime ? chamaUsage.oldestTxTime.getTime() : now;
      const resetInSeconds = Math.max(0, Math.ceil((oldestTxTime + 24 * 60 * 60 * 1000 - now) / 1000));
      
      res.status(429).json({
        success: false,
        error: 'Too Many Requests: Chama has reached the daily limit of 20 sponsored transactions.',
        limitType: 'chama',
        resetInSeconds,
      });
      return;
    }

    // 6. Process sponsorship (simulation, channel selection, fee bump transaction signing & submission)
    const result = await stellarService.processSponsorship(transactionXdr);

    // 7. Update Micro-Fee Ledger & Counter Log
    await dbService.logTransaction(
      chamaId,
      memberAddress,
      result.txHash,
      result.functionName,
      result.feeStroops,
      result.feeXlm,
      result.feeKes
    );

    res.json({
      success: true,
      txHash: result.txHash,
      ledger: result.ledger,
    });
  } catch (err: any) {
    console.error('Sponsorship endpoint processing error:', err);
    res.status(500).json({
      success: false,
      error: `Internal Server Error: ${err.message}`,
    });
  }
});

/**
 * POST /api/v1/admin/reconcile
 * Trigger manual reconciliation (for demo/testing/admin purposes)
 */
app.post('/api/v1/admin/reconcile', verifyAdminToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { chamaId } = req.body;
    if (chamaId) {
      const result = await reconcileChama(chamaId);
      res.json({ success: true, results: [result] });
    } else {
      const results = await runAllReconciliations();
      res.json({ success: true, results });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/admin/topup
 * Add manual funds to a Chama float (for testing/admin)
 */
app.post('/api/v1/admin/topup', verifyAdminToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { chamaId, amountKes } = req.body;
    if (!chamaId || amountKes === undefined) {
      res.status(400).json({ success: false, error: 'chamaId and amountKes are required' });
      return;
    }
    const updated = await dbService.updateChamaFloat(chamaId, parseFloat(amountKes));
    res.json({ success: true, chama: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* Global Error Handler */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred on the server',
  });
});

export default app;