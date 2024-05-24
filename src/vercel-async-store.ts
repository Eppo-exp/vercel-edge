import { IAsyncStore } from '@eppo/js-client-sdk-common';

import EdgeConfigStore from './edge-config-store';

export default class VercelAsyncStore<T> implements IAsyncStore<T> {
  private client: EdgeConfigStore;
  private storageKey = 'eppo-configuration';
  private createdAtKey = 'eppo-configuration-created-at';
  private _isInitialized = false;

  /**
   * @param edgeConfig Vercel Edge config store connection string (usually Vercel creates EDGE_CONFIG env var, this is what needed)
   * @param edgeStoreId Vercel Edge config store id
   * @param vercelApiToken  Vercel api token, used for store write operations
   * @param expirationTimeSeconds
   */
  constructor(
    edgeConfig: string,
    edgeConfigStoreId: string,
    edgeConfigToken: string,
    private expirationTimeSeconds = 20,
  ) {
    this.client = new EdgeConfigStore(edgeConfig, edgeConfigStoreId, edgeConfigToken);
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  async isExpired(): Promise<boolean> {
    const lastConfigCreatedAt = await this.client.get<number>(this.createdAtKey);

    if (!lastConfigCreatedAt) {
      return true;
    }

    return lastConfigCreatedAt + this.expirationTimeSeconds * 1000 < Date.now();
  }

  async getEntries(): Promise<Record<string, T>> {
    const configuration = await this.client.get<T>(this.storageKey);

    if (!configuration) {
      return {};
    }

    return configuration;
  }

  async setEntries(entries: Record<string, T>): Promise<void> {
    await this.client.set(this.storageKey, entries);
    await this.client.set(this.createdAtKey, Date.now());

    this._isInitialized = true;

    return Promise.resolve();
  }
}
