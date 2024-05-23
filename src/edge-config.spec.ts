import { createClient } from '@vercel/edge-config';

import EdgeConfigStoreService from './edge-config';

jest.mock('@vercel/edge-config', () => ({
  createClient: jest.fn(),
}));

describe('EdgeConfigStoreService', () => {
  let service: EdgeConfigStoreService;
  let mockClient: { get: jest.Mock; has: jest.Mock };
  const mockEdgeConfig = 'mockEdgeConfig';
  const mockEdgeStoreId = 'mockEdgeStoreId';
  const mockVercelApiToken = 'mockVercelApiToken';

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      has: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(mockClient);
    service = new EdgeConfigStoreService(mockEdgeConfig, mockEdgeStoreId, mockVercelApiToken);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize client using createClient', () => {
    expect(createClient).toHaveBeenCalledWith(mockEdgeConfig);
    expect(service.client).toBe(mockClient);
  });

  describe('get method', () => {
    it('should return the value for a given key', async () => {
      const mockKey = 'testKey';
      const mockValue = 'testValue';
      mockClient.get.mockResolvedValue(mockValue);

      const result = await service.get(mockKey);

      expect(mockClient.get).toHaveBeenCalledWith(mockKey);
      expect(result).toBe(mockValue);
    });
  });

  describe('set method', () => {
    it('should create a new item if key does not exist', async () => {
      const mockKey = 'newKey';
      const mockValue = 'newValue';
      mockClient.has.mockResolvedValue(false);

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          headers: new Headers(),
          redirected: false,
          status: 200,
          statusText: 'OK',
          type: 'basic',
          url: '',
          clone: jest.fn(),
          body: null,
          bodyUsed: false,
          arrayBuffer: jest.fn(),
          blob: jest.fn(),
          formData: jest.fn(),
          text: jest.fn(),
        } as unknown as Response),
      );

      await service.set(mockKey, mockValue);

      expect(mockClient.has).toHaveBeenCalledWith(mockKey);
      expect(fetch).toHaveBeenCalledWith(
        `${service._baseUrl}${mockEdgeStoreId}/items`,
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${mockVercelApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                operation: 'create',
                key: mockKey,
                value: mockValue,
              },
            ],
          }),
        }),
      );
    });

    it('should update an existing item if key exists', async () => {
      const mockKey = 'existingKey';
      const mockValue = 'updatedValue';
      mockClient.has.mockResolvedValue(true);

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          headers: new Headers(),
          redirected: false,
          status: 200,
          statusText: 'OK',
          type: 'basic',
          url: '',
          clone: jest.fn(),
          body: null,
          bodyUsed: false,
          arrayBuffer: jest.fn(),
          blob: jest.fn(),
          formData: jest.fn(),
          text: jest.fn(),
        } as unknown as Response),
      );

      await service.set(mockKey, mockValue);

      expect(mockClient.has).toHaveBeenCalledWith(mockKey);
      expect(fetch).toHaveBeenCalledWith(
        `${service._baseUrl}${mockEdgeStoreId}/items`,
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${mockVercelApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              {
                operation: 'update',
                key: mockKey,
                value: mockValue,
              },
            ],
          }),
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      const mockKey = 'errorKey';
      const mockValue = 'errorValue';
      mockClient.has.mockResolvedValue(true);

      const errorMessage = 'Test error';
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: errorMessage } }),
          headers: new Headers(),
          redirected: false,
          status: 400,
          statusText: 'Bad Request',
          type: 'basic',
          url: '',
          clone: jest.fn(),
          body: null,
          bodyUsed: false,
          arrayBuffer: jest.fn(),
          blob: jest.fn(),
          formData: jest.fn(),
          text: jest.fn(),
        } as unknown as Response),
      );

      console.error = jest.fn();

      await service.set(mockKey, mockValue);

      expect(console.error).toHaveBeenCalledWith(new Error(errorMessage));
    });
  });
});
