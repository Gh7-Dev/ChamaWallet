import { dbService } from '../services/db.service';
import { config } from '../config';

/**
 * Runs a reconciliation audit for a specific Chama.
 * Audits total transaction fee usage vs. micro-fee contributions in the last 30 days,
 * records a reconciliation log, and flags groups operating near their safety threshold.
 */
/** Strip newline/carriage-return characters to prevent log injection (CWE-117). */
const sanitizeLog = (s: string): string => String(s).replace(/[\r\n]/g, ' ');

export async function reconcileChama(chamaId: string): Promise<{
  chamaId: string;
  totalUsageKes: number;
  totalContributionsKes: number;
  netImpactKes: number;
  currentFloatKes: number;
  alertFlagged: boolean;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Fetch current float
  const floatRecord = await dbService.getChamaFloat(chamaId);

  // 2. Fetch usage summary since 30 days ago
  const summary = await dbService.getChamaUsageSummary(chamaId, thirtyDaysAgo, now);

  // 3. Log the reconciliation
  await dbService.logReconciliation(
    chamaId,
    thirtyDaysAgo,
    now,
    summary.totalUsageXlm,
    summary.totalUsageKes,
    summary.totalContributionsKes
  );

  const netImpactKes = summary.totalContributionsKes - summary.totalUsageKes;
  const alertFlagged = floatRecord.opexFloat < config.warningFloatThresholdKes;

  if (alertFlagged) {
    console.warn(
      `[RECONCILIATION ALERT] Chama ${sanitizeLog(chamaId)} is operating near its safety threshold! ` +
      `Current Float: ${floatRecord.opexFloat.toFixed(2)} KES (Threshold: ${config.minFloatThresholdKes} KES). ` +
      `Please top up during the next meeting cycle.`
    );
  } else {
    console.log(
      `[RECONCILIATION SUCCESS] Chama ${sanitizeLog(chamaId)} reconciled successfully. ` +
      `Current Float: ${floatRecord.opexFloat.toFixed(2)} KES.`
    );
  }

  return {
    chamaId,
    totalUsageKes: summary.totalUsageKes,
    totalContributionsKes: summary.totalContributionsKes,
    netImpactKes,
    currentFloatKes: floatRecord.opexFloat,
    alertFlagged,
  };
}

/**
 * Runs reconciliation for all registered Chamas.
 */
export async function runAllReconciliations(): Promise<any[]> {
  console.log('[RECONCILIATION JOB] Starting automated 30-day reconciliation for all Chamas...');
  const chamaIds = await dbService.getAllChamaIds();
  const results = [];

  for (const id of chamaIds) {
    try {
      const result = await reconcileChama(id);
      results.push(result);
    } catch (err: any) {
      console.error(`[RECONCILIATION ERROR] Failed to reconcile Chama ${sanitizeLog(id)}:`, err.message);
    }
  }

  console.log(`[RECONCILIATION JOB] Finished. Audited ${results.length} Chamas.`);
  return results;
}
