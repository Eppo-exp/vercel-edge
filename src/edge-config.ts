import { createClient, EdgeConfigClient } from '@vercel/edge-config';

export default class EdgeConfigStoreService {
  private baseUrl = 'https://api.vercel.com/v1/edge-config/';
  public client: EdgeConfigClient;

  /**
   *
   * @param edgeConfig edge config store connection string
   * @param edgeStoreId edge config store id
   * @param vercelApiToken  vercel api token, used for store write operations
   */
  public constructor(
    edgeConfig: string,
    private edgeStoreId: string,
    private vercelApiToken: string,
  ) {
    this.client = createClient(edgeConfig);
  }

  public async get<T>(key: string): Promise<T> {
    return (await this.client.get(key)) as T;
  }

  public async set(key: string, value: object | string | number) {
    try {
      const operation = (await this.client.has(key)) ? 'update' : 'create';

      const updateEdgeConfig = await fetch(`${this.baseUrl}${this.edgeStoreId}/items`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.vercelApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              operation,
              key,
              value,
            },
          ],
        }),
      });

      const result = await updateEdgeConfig.json();
      console.log({ result });
      return result;
    } catch (error) {
      console.log(error);
    }
  }
}
