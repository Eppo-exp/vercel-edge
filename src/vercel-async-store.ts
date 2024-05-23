import { IAsyncStore } from "@eppo/js-client-sdk-common";
import EdgeConfigStoreService from "./edge-config";

export default class VercelAsyncStore<T> implements IAsyncStore<T> {
  private expirationTimeSeconds = 20;
  private client: EdgeConfigStoreService;
  private storageKey = 'eppo-configuration';
  private createdAtKey = 'eppo-configuration-created-at';
  private _isInitialized = false;

  constructor(edgeConfig: string, edgeConfigStoreId: string, edgeConfigToken: string ) {
    // todo remove or move
    // if (!process.env.EDGE_CONFIG) {
    //   throw new Error('Define EDGE_CONFIG env variable');
    // }

    // if (!process.env.EDGE_CONFIG_STORE_ID) {
    //   throw new Error('Define EDGE_CONFIG_STORE_ID env variable')
    // }

    // if (!process.env.EDGE_CONFIG_TOKEN) {
    //   throw new Error('Define EDGE_CONFIG_TOKEN env variable')
    // }

    this.client = new EdgeConfigStoreService(
      edgeConfig, 
      edgeConfigStoreId, 
      edgeConfigToken
    );
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
    await this.client.set(this.createdAtKey, Date.now())
    
    this._isInitialized = true;
    
    return Promise.resolve();
  }
}
