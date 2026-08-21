import { Keypair } from '@stellar/stellar-sdk';
import { config } from '../config';

export interface ChannelAccount {
  keypair: Keypair;
  isLocked: boolean;
}

/** Strip newline/carriage-return characters to prevent log injection (CWE-117). */
const sanitizeLog = (s: string): string => String(s).replace(/[\r\n]/g, ' ');

class ChannelPoolService {
  private channels: ChannelAccount[] = [];

  constructor() {
    this.initializePool();
  }

  /**
   * Initializes the pool with preconfigured or dynamically generated channel accounts.
   */
  private initializePool() {
    if (config.channelSecrets && config.channelSecrets.length > 0) {
      console.log(`Initializing Channel Pool with ${config.channelSecrets.length} configured channel keys.`);
      this.channels = config.channelSecrets.map((secret) => ({
        keypair: Keypair.fromSecret(secret.trim()),
        isLocked: false,
      }));
    } else {
      // Dynamic fallback for Phase 1 / Testing
      console.log('No CHANNEL_SECRETS configured. Generating 5 dynamic channel accounts for local testing/demo pool.');
      for (let i = 0; i < 5; i++) {
        this.channels.push({
          keypair: Keypair.random(),
          isLocked: false,
        });
      }
    }
  }

  /**
   * Acquires a channel account from the pool.
   * If all channels are currently locked, it polls/waits until one becomes free.
   */
  async acquireChannel(timeoutMs: number = 10000): Promise<Keypair> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const availableChannel = this.channels.find((c) => !c.isLocked);
      if (availableChannel) {
        availableChannel.isLocked = true;
        console.log(`Acquired Channel Account: ${availableChannel.keypair.publicKey()}`);
        return availableChannel.keypair;
      }
      // Wait 100ms and try again
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timeout: No available channel accounts in the pool.');
  }

  /**
   * Releases a channel account back into the pool.
   */
  releaseChannel(publicKey: string): void {
    const channel = this.channels.find((c) => c.keypair.publicKey() === publicKey);
    if (channel) {
      channel.isLocked = false;
      console.log(`Released Channel Account: ${sanitizeLog(publicKey)}`);
    } else {
      console.warn(`Attempted to release a channel account that does not belong to the pool: ${sanitizeLog(publicKey)}`);
    }
  }

  /**
   * Get all channel public keys (for status or funding info)
   */
  getChannelPublicKeys(): string[] {
    return this.channels.map((c) => c.keypair.publicKey());
  }

  /**
   * Get current pool utilization status
   */
  getPoolStatus() {
    const total = this.channels.length;
    const locked = this.channels.filter((c) => c.isLocked).length;
    return {
      total,
      available: total - locked,
      locked,
    };
  }
}

export const channelPoolService = new ChannelPoolService();
export default channelPoolService;
