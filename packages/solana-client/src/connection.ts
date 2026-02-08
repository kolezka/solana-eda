import { Connection, PublicKey, Transaction, ComputeBudgetProgram, SystemProgram } from '@solana/web3.js';
import type { AccountInfo, Context } from '@solana/web3.js';

export class SolanaConnectionManager {
  private connection: Connection;
  private wsConnection: Connection | null = null;

  constructor(
    rpcUrl: string,
    private wsUrl?: string
  ) {
    this.connection = new Connection(rpcUrl);
    if (wsUrl) {
      this.wsConnection = new Connection(wsUrl, 'confirmed');
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getWsConnection(): Connection | null {
    return this.wsConnection;
  }

  getWsUrl(): string | undefined {
    return this.wsUrl;
  }

  /**
   * Subscribe to account changes via WebSocket
   */
  onAccountChange(
    publicKey: PublicKey,
    callback: (accountInfo: AccountInfo<Buffer> | null, context: Context) => void,
    commitment?: 'confirmed' | 'finalized' | 'processed'
  ): number {
    const conn = this.wsConnection || this.connection;
    return conn.onAccountChange(publicKey, callback, commitment);
  }

  /**
   * Remove account change listener
   */
  removeAccountChangeListener(subscriptionId: number): void {
    const conn = this.wsConnection || this.connection;
    conn.removeAccountChangeListener(subscriptionId);
  }

  /**
   * Subscribe to logs via WebSocket
   */
  onLogs(
    filter: any,
    callback: (logs: any, context: any) => void,
    commitment?: 'confirmed' | 'finalized' | 'processed'
  ): number {
    const conn = this.wsConnection || this.connection;
    return conn.onLogs(filter, callback, commitment);
  }

  /**
   * Remove logs subscription
   */
  removeOnLogsListener(subscriptionId: number): void {
    const conn = this.wsConnection || this.connection;
    conn.removeOnLogsListener(subscriptionId);
  }

  /**
   * Get account info
   */
  async getAccountInfo(publicKey: PublicKey): Promise<AccountInfo<Buffer> | null> {
    return await this.connection.getAccountInfo(publicKey);
  }

  /**
   * Get multiple accounts
   */
  async getMultipleAccounts(publicKeys: PublicKey[]): Promise<(AccountInfo<Buffer> | null)[]> {
    return await this.connection.getMultipleAccountsInfo(publicKeys);
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature: string): Promise<any | null> {
    return await this.connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
  }

  /**
   * Get latest blockhash
   */
  async getLatestBlockhash(): Promise<{ blockhash: string }> {
    return await this.connection.getLatestBlockhash();
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(
    transaction: Buffer,
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ): Promise<string> {
    return await this.connection.sendRawTransaction(transaction, options);
  }

  /**
   * Confirm transaction
   */
  async confirmTransaction(signature: string): Promise<any> {
    return await this.connection.confirmTransaction(signature);
  }

  /**
   * Get balance
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    return await this.connection.getBalance(publicKey);
  }

  /**
   * Get token account balance
   */
  async getTokenAccountBalance(tokenAccount: PublicKey): Promise<{ amount: string; decimals: number; uiAmount: number }> {
    const response = await this.connection.getTokenAccountBalance(tokenAccount);
    return {
      amount: response.value.amount,
      decimals: response.value.decimals,
      uiAmount: response.value.uiAmount || 0,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    // Connection doesn't have a close method in newer versions
    // Just clean up references
    if (this.wsConnection) {
      // WebSocket connection might have close, but safest is to just let it go out of scope
      this.wsConnection = null as any;
    }
  }
}
