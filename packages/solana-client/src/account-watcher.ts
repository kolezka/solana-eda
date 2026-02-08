import { PublicKey } from '@solana/web3.js';
import type { AccountInfo } from '@solana/web3.js';
import { SolanaConnectionManager } from './connection';

export type AccountChangeCallback = (
  accountInfo: AccountInfo<Buffer> | null,
  context: any
) => void;

export class AccountWatcher {
  private connection: SolanaConnectionManager;
  private subscriptions: Map<string, number>;

  constructor(connection: SolanaConnectionManager) {
    this.connection = connection;
    this.subscriptions = new Map();
  }

  watchAccount(
    publicKey: PublicKey | string,
    callback: AccountChangeCallback
  ): number {
    const pubKey = typeof publicKey === 'string' ? new PublicKey(publicKey) : publicKey;

    const subscriptionId = this.connection.onAccountChange(pubKey, callback, 'confirmed');

    const keyStr = pubKey.toString();
    this.subscriptions.set(keyStr, subscriptionId);

    return subscriptionId;
  }

  unwatchAccount(publicKey: PublicKey | string): void {
    const keyStr = typeof publicKey === 'string' ? publicKey : publicKey.toString();
    const subscriptionId = this.subscriptions.get(keyStr);

    if (subscriptionId !== undefined) {
      this.connection.removeAccountChangeListener(subscriptionId);
      this.subscriptions.delete(keyStr);
    }
  }

  unwatchAll(): void {
    for (const [key, subscriptionId] of this.subscriptions.entries()) {
      this.connection.removeAccountChangeListener(subscriptionId);
    }
    this.subscriptions.clear();
  }

  getWatchedAccounts(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getWatchedAccountCount(): number {
    return this.subscriptions.size;
  }
}
