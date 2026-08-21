import { Pool } from 'pg';
import { config } from '../config';

export interface ChamaFloat {
  chamaId: string;
  name?: string;
  opexFloat: number; // in KES
  status: 'Normal' | 'Warning' | 'Locked';
  lastUpdated: Date;
}

export interface TransactionLog {
  id: number;
  chamaId: string;
  memberAddress: string;
  txHash: string;
  functionName: string;
  feeStroops: number;
  feeXlm: number;
  feeKes: number;
  createdAt: Date;
}

export interface ReconciliationLog {
  id: number;
  chamaId: string;
  periodStart: Date;
  periodEnd: Date;
  totalUsageXlm: number;
  totalUsageKes: number;
  totalContributionsKes: number;
  reconciledAt: Date;
}

class DbService {
  private pool: Pool | null = null;
  
  // In-memory tables for local development/testing or when USE_IN_MEMORY_DB is enabled
  private inMemoryChamas: Map<string, ChamaFloat> = new Map();
  private inMemoryTxLogs: TransactionLog[] = [];
  private inMemoryReconciliationLogs: ReconciliationLog[] = [];
  private nextTxLogId = 1;
  private nextReconLogId = 1;

  constructor() {
    if (!config.useInMemoryDb && config.databaseUrl) {
      this.pool = new Pool({
        connectionString: config.databaseUrl,
      });
      console.log('Connected to PostgreSQL Database.');
    } else {
      console.log('Using in-memory database fallback (for testing and development).');
    }
  }

  // Helper to destroy connection pool (useful for tests)
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  // Clear in-memory db (for testing)
  clearInMemoryDb() {
    this.inMemoryChamas.clear();
    this.inMemoryTxLogs = [];
    this.inMemoryReconciliationLogs = [];
    this.nextTxLogId = 1;
    this.nextReconLogId = 1;
  }

  /**
   * Get Chama Float record. If not found, it is auto-created with the default float.
   */
  async getChamaFloat(chamaId: string): Promise<ChamaFloat> {
    if (this.pool) {
      try {
        const res = await this.pool.query(
          'SELECT chama_id AS "chamaId", name, opex_float AS "opexFloat", status, last_updated AS "lastUpdated" FROM chama_floats WHERE chama_id = $1',
          [chamaId]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            chamaId: row.chamaId,
            name: row.name,
            opexFloat: parseFloat(row.opexFloat),
            status: row.status as 'Normal' | 'Warning' | 'Locked',
            lastUpdated: row.lastUpdated,
          };
        }
        // Auto-create
        await this.createChama(chamaId, `${chamaId} Chama`);
        return this.getChamaFloat(chamaId);
      } catch (err) {
        console.error('Database query error in getChamaFloat:', err);
        throw err;
      }
    } else {
      let chama = this.inMemoryChamas.get(chamaId);
      if (!chama) {
        chama = {
          chamaId,
          name: `${chamaId} Chama`,
          opexFloat: 1000.0, // Default 1000 KES
          status: 'Normal',
          lastUpdated: new Date(),
        };
        this.inMemoryChamas.set(chamaId, chama);
      }
      return { ...chama };
    }
  }

  /**
   * Create a Chama float record
   */
  async createChama(chamaId: string, name?: string, initialFloat: number = 1000.0): Promise<void> {
    const status = this.determineStatus(initialFloat);
    if (this.pool) {
      await this.pool.query(
        'INSERT INTO chama_floats (chama_id, name, opex_float, status) VALUES ($1, $2, $3, $4) ON CONFLICT (chama_id) DO NOTHING',
        [chamaId, name, initialFloat, status]
      );
    } else {
      if (!this.inMemoryChamas.has(chamaId)) {
        this.inMemoryChamas.set(chamaId, {
          chamaId,
          name,
          opexFloat: initialFloat,
          status,
          lastUpdated: new Date(),
        });
      }
    }
  }

  /**
   * Update the Chama Float balance and update the threshold status
   */
  async updateChamaFloat(chamaId: string, deltaKsh: number): Promise<ChamaFloat> {
    const current = await this.getChamaFloat(chamaId);
    const newFloat = Math.max(0, current.opexFloat + deltaKsh);
    const newStatus = this.determineStatus(newFloat);

    if (this.pool) {
      const res = await this.pool.query(
        'UPDATE chama_floats SET opex_float = $1, status = $2, last_updated = CURRENT_TIMESTAMP WHERE chama_id = $3 RETURNING chama_id AS "chamaId", name, opex_float AS "opexFloat", status, last_updated AS "lastUpdated"',
        [newFloat, newStatus, chamaId]
      );
      const row = res.rows[0];
      return {
        chamaId: row.chamaId,
        name: row.name,
        opexFloat: parseFloat(row.opexFloat),
        status: row.status as 'Normal' | 'Warning' | 'Locked',
        lastUpdated: row.lastUpdated,
      };
    } else {
      const chama = this.inMemoryChamas.get(chamaId)!;
      chama.opexFloat = newFloat;
      chama.status = newStatus;
      chama.lastUpdated = new Date();
      this.inMemoryChamas.set(chamaId, chama);
      return { ...chama };
    }
  }

  /**
   * Log transaction and update the Chama's float based on micro-fee contributions
   */
  async logTransaction(
    chamaId: string,
    memberAddress: string,
    txHash: string,
    functionName: string,
    feeStroops: number,
    feeXlm: number,
    feeKes: number
  ): Promise<void> {
    // Determine float adjustment
    // 1. Deduct actual sponsored gas cost from the Chama opex float
    let floatAdjustment = -feeKes;

    // 2. Add micro-fee contributions based on function types
    // - Deposits: Deduct flat 0.50 KES equivalent from deposit transfers into the group float
    // - Withdrawals: Deduct flat 2.00 KES equivalent from withdrawal transfers into the group float
    if (functionName === 'deposit') {
      floatAdjustment += config.microFeeDepositContributionKes;
    } else if (functionName === 'propose_withdrawal' || functionName === 'approve_withdrawal') {
      // Each withdrawal interaction contributes 2.00 KES (representing deduction on transfers)
      floatAdjustment += config.microFeeWithdrawalContributionKes;
    }

    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        
        // Log transaction
        await client.query(
          'INSERT INTO transaction_logs (chama_id, member_address, tx_hash, function_name, fee_stroops, fee_xlm, fee_kes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [chamaId, memberAddress, txHash, functionName, feeStroops, feeXlm, feeKes]
        );

        // Update float
        const currentRes = await client.query('SELECT opex_float FROM chama_floats WHERE chama_id = $1 FOR UPDATE', [chamaId]);
        const currentFloat = parseFloat(currentRes.rows[0]?.opex_float || '0');
        const newFloat = Math.max(0, currentFloat + floatAdjustment);
        const newStatus = this.determineStatus(newFloat);

        await client.query(
          'UPDATE chama_floats SET opex_float = $1, status = $2, last_updated = CURRENT_TIMESTAMP WHERE chama_id = $3',
          [newFloat, newStatus, chamaId]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Transaction rollback in logTransaction:', err);
        throw err;
      } finally {
        client.release();
      }
    } else {
      // In-Memory
      const logEntry: TransactionLog = {
        id: this.nextTxLogId++,
        chamaId,
        memberAddress,
        txHash,
        functionName,
        feeStroops,
        feeXlm,
        feeKes,
        createdAt: new Date(),
      };
      this.inMemoryTxLogs.push(logEntry);
      
      await this.updateChamaFloat(chamaId, floatAdjustment);
    }
  }

  /**
   * Get member transaction usage within sliding 24h window
   */
  async getMemberUsage(memberAddress: string): Promise<{ count: number; oldestTxTime?: Date }> {
    const cutOff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (this.pool) {
      const res = await this.pool.query(
        'SELECT count(*)::int AS count, min(created_at) AS "oldestTxTime" FROM transaction_logs WHERE member_address = $1 AND created_at > $2',
        [memberAddress, cutOff]
      );
      return {
        count: res.rows[0].count,
        oldestTxTime: res.rows[0].oldestTxTime ? new Date(res.rows[0].oldestTxTime) : undefined,
      };
    } else {
      const txs = this.inMemoryTxLogs.filter(
        (t) => t.memberAddress === memberAddress && t.createdAt > cutOff
      );
      const oldest = txs.length > 0 ? new Date(Math.min(...txs.map((t) => t.createdAt.getTime()))) : undefined;
      return {
        count: txs.length,
        oldestTxTime: oldest,
      };
    }
  }

  /**
   * Get Chama transaction usage within sliding 24h window
   */
  async getChamaUsage(chamaId: string): Promise<{ count: number; oldestTxTime?: Date }> {
    const cutOff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (this.pool) {
      const res = await this.pool.query(
        'SELECT count(*)::int AS count, min(created_at) AS "oldestTxTime" FROM transaction_logs WHERE chama_id = $1 AND created_at > $2',
        [chamaId, cutOff]
      );
      return {
        count: res.rows[0].count,
        oldestTxTime: res.rows[0].oldestTxTime ? new Date(res.rows[0].oldestTxTime) : undefined,
      };
    } else {
      const txs = this.inMemoryTxLogs.filter(
        (t) => t.chamaId === chamaId && t.createdAt > cutOff
      );
      const oldest = txs.length > 0 ? new Date(Math.min(...txs.map((t) => t.createdAt.getTime()))) : undefined;
      return {
        count: txs.length,
        oldestTxTime: oldest,
      };
    }
  }

  /**
   * Gets total fee usage and total micro-fee contributions for reconciliation
   */
  async getChamaUsageSummary(
    chamaId: string,
    since: Date,
    to: Date
  ): Promise<{ totalUsageXlm: number; totalUsageKes: number; totalContributionsKes: number }> {
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT 
          COALESCE(SUM(fee_xlm), 0)::float as "totalUsageXlm",
          COALESCE(SUM(fee_kes), 0)::float as "totalUsageKes",
          COALESCE(SUM(CASE 
            WHEN function_name = 'deposit' THEN $1 
            WHEN function_name IN ('propose_withdrawal', 'approve_withdrawal') THEN $2
            ELSE 0 
          END), 0)::float as "totalContributionsKes"
         FROM transaction_logs 
         WHERE chama_id = $3 AND created_at >= $4 AND created_at <= $5`,
        [
          config.microFeeDepositContributionKes,
          config.microFeeWithdrawalContributionKes,
          chamaId,
          since,
          to,
        ]
      );
      return {
        totalUsageXlm: res.rows[0].totalUsageXlm,
        totalUsageKes: res.rows[0].totalUsageKes,
        totalContributionsKes: res.rows[0].totalContributionsKes,
      };
    } else {
      const logs = this.inMemoryTxLogs.filter(
        (l) => l.chamaId === chamaId && l.createdAt >= since && l.createdAt <= to
      );
      let totalUsageXlm = 0;
      let totalUsageKes = 0;
      let totalContributionsKes = 0;

      for (const l of logs) {
        totalUsageXlm += l.feeXlm;
        totalUsageKes += l.feeKes;
        if (l.functionName === 'deposit') {
          totalContributionsKes += config.microFeeDepositContributionKes;
        } else if (l.functionName === 'propose_withdrawal' || l.functionName === 'approve_withdrawal') {
          totalContributionsKes += config.microFeeWithdrawalContributionKes;
        }
      }

      return { totalUsageXlm, totalUsageKes, totalContributionsKes };
    }
  }

  /**
   * Logs a reconciliation event
   */
  async logReconciliation(
    chamaId: string,
    periodStart: Date,
    periodEnd: Date,
    totalUsageXlm: number,
    totalUsageKes: number,
    totalContributionsKes: number
  ): Promise<void> {
    if (this.pool) {
      await this.pool.query(
        'INSERT INTO reconciliation_logs (chama_id, period_start, period_end, total_usage_xlm, total_usage_kes, total_contributions_kes) VALUES ($1, $2, $3, $4, $5, $6)',
        [chamaId, periodStart, periodEnd, totalUsageXlm, totalUsageKes, totalContributionsKes]
      );
    } else {
      const entry: ReconciliationLog = {
        id: this.nextReconLogId++,
        chamaId,
        periodStart,
        periodEnd,
        totalUsageXlm,
        totalUsageKes,
        totalContributionsKes,
        reconciledAt: new Date(),
      };
      this.inMemoryReconciliationLogs.push(entry);
    }
  }

  /**
   * Helper to determine status based on KES float balance
   */
  private determineStatus(floatKes: number): 'Normal' | 'Warning' | 'Locked' {
    if (floatKes < config.minFloatThresholdKes) {
      return 'Locked';
    } else if (floatKes < config.warningFloatThresholdKes) {
      return 'Warning';
    } else {
      return 'Normal';
    }
  }

  /**
   * Get all active Chama IDs (for background jobs)
   */
  async getAllChamaIds(): Promise<string[]> {
    if (this.pool) {
      const res = await this.pool.query('SELECT chama_id AS "chamaId" FROM chama_floats');
      return res.rows.map((r) => r.chamaId);
    } else {
      return Array.from(this.inMemoryChamas.keys());
    }
  }
}

export const dbService = new DbService();
export default dbService;
