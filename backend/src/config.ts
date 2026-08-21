import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL, // e.g. postgresql://postgres:postgres@localhost:5432/chamavault
  useInMemoryDb: process.env.USE_IN_MEMORY_DB !== 'false', // Defaults to true if no DATABASE_URL is provided
  
  // Stellar configurations
  stellarNetwork: process.env.STELLAR_NETWORK || 'TESTNET', // TESTNET or MAINNET
  stellarRpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
  
  // Relayer Master Account
  relayerSecret: process.env.RELAYER_SECRET, // Required
  
  // Channel Account Pools (comma-separated secrets)
  // For production, these should be securely stored secrets. For Phase 1 we can fallback to generating or using derived keys if empty.
  channelSecrets: process.env.CHANNEL_SECRETS ? process.env.CHANNEL_SECRETS.split(',') : [],
  
  // Conversion rate: KES per XLM
  kesPerXlm: parseFloat(process.env.KES_PER_XLM || '15.00'),
  
  // Minimum Float Threshold
  minFloatThresholdKes: parseFloat(process.env.MIN_FLOAT_THRESHOLD_KES || '500.00'),
  warningFloatThresholdKes: parseFloat(process.env.WARNING_FLOAT_THRESHOLD_KES || '600.00'),
  
  // Micro-fee deductions (in KES)
  microFeeDepositContributionKes: 0.50,
  microFeeWithdrawalContributionKes: 2.00,
  
  // Rate limits
  maxMemberTxsPer24h: 5,
  maxChamaTxsPer24h: 20,
};

if (!process.env.RELAYER_SECRET) {
  throw new Error('RELAYER_SECRET must be set in environment');
}
if (!process.env.ADMIN_AUTH_TOKEN) {
  throw new Error('ADMIN_AUTH_TOKEN must be set in environment');
}