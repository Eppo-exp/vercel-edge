/**
 * @jest-environment jsdom
 */

import { createHash } from 'crypto';

import {
  Flag,
  VariationType,
  constants,
  HybridConfigurationStore,
} from '@eppo/js-client-sdk-common';
import { createClient } from '@vercel/edge-config';
import * as md5 from 'md5';
import * as td from 'testdouble';
import { encode } from 'universal-base64';

const { POLL_INTERVAL_MS, POLL_JITTER_PCT } = constants;

import {
  IAssignmentTestCase,
  readAssignmentTestData,
  readMockUfcResponse,
  MOCK_UFC_RESPONSE_FILE,
  OBFUSCATED_MOCK_UFC_RESPONSE_FILE,
  getTestAssignments,
  validateTestAssignments,
} from '../test/testHelpers';

import { IAssignmentLogger, IEppoClient, getInstance, init } from './index';

function md5Hash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

function base64Encode(input: string): string {
  return Buffer.from(input).toString('base64');
}

// Configuration for a single flag within the UFC.
const apiKey = 'dummy';
const baseUrl = 'http://127.0.0.1:4000';

const flagKey = 'mock-experiment';
const obfuscatedFlagKey = md5(flagKey);

const allocationKey = 'traffic-split';
const obfuscatedAllocationKey = base64Encode(allocationKey);

jest.mock('@vercel/edge-config', () => ({
  createClient: jest.fn(),
}));

const mockUfcFlagConfig: Flag = {
  key: obfuscatedFlagKey,
  enabled: true,
  variationType: VariationType.STRING,
  variations: {
    [base64Encode('control')]: {
      key: base64Encode('control'),
      value: base64Encode('control'),
    },
    [base64Encode('variant-1')]: {
      key: base64Encode('variant-1'),
      value: base64Encode('variant-1'),
    },
    [base64Encode('variant-2')]: {
      key: base64Encode('variant-2'),
      value: base64Encode('variant-2'),
    },
  },
  allocations: [
    {
      key: obfuscatedAllocationKey,
      rules: [],
      splits: [
        {
          variationKey: base64Encode('control'),
          shards: [
            {
              salt: base64Encode('some-salt'),
              ranges: [{ start: 0, end: 3400 }],
            },
          ],
        },
        {
          variationKey: base64Encode('variant-1'),
          shards: [
            {
              salt: base64Encode('some-salt'),
              ranges: [{ start: 3400, end: 6700 }],
            },
          ],
        },
        {
          variationKey: base64Encode('variant-2'),
          shards: [
            {
              salt: base64Encode('some-salt'),
              ranges: [{ start: 6700, end: 10000 }],
            },
          ],
        },
      ],
      doLog: true,
    },
  ],
  totalShards: 10000,
};

describe('EppoJSClient E2E test', () => {
  let globalClient: IEppoClient;
  let mockLogger: IAssignmentLogger;
  let mockClient: { get: jest.Mock; has: jest.Mock };

  beforeAll(async () => {
    global.fetch = jest.fn(() => {
      const ufc = readMockUfcResponse(MOCK_UFC_RESPONSE_FILE);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ufc),
      });
    }) as jest.Mock;

    mockLogger = td.object<IAssignmentLogger>();

    mockClient = {
      get: jest.fn(),
      has: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(mockClient);

    globalClient = await init({
      apiKey,
      baseUrl,
      assignmentLogger: mockLogger,
      vercelParams: {
        edgeConfig: 'edge-config',
        edgeConfigStoreId: 'edge-config-store-id',
        vercelApiToken: 'vercel-api-token',
      },
    });
  });

  afterEach(() => {
    globalClient.setLogger(mockLogger);
    td.reset();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns default value when experiment config is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => null as null);
    const assignment = globalClient.getStringAssignment(flagKey, 'subject-10', {}, 'default-value');
    expect(assignment).toEqual('default-value');
  });

  it('logs variation assignment and experiment key', () => {
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }

      return mockUfcFlagConfig;
    });

    const subjectAttributes = { foo: 3 };
    globalClient.setLogger(mockLogger);
    const assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      subjectAttributes,
      'default-value',
    );

    expect(assignment).toEqual('variant-1');
    expect(td.explain(mockLogger.logAssignment).callCount).toEqual(1);
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].subject).toEqual('subject-10');
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].featureFlag).toEqual(flagKey);
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].experiment).toEqual(
      `${flagKey}-${allocationKey}`,
    );
    expect(td.explain(mockLogger?.logAssignment).calls[0]?.args[0].allocation).toEqual(
      `${allocationKey}`,
    );
  });

  it('handles logging exception', () => {
    const mockLogger = td.object<IAssignmentLogger>();
    td.when(mockLogger.logAssignment(td.matchers.anything())).thenThrow(new Error('logging error'));
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }
      return mockUfcFlagConfig;
    });
    const subjectAttributes = { foo: 3 };
    globalClient.setLogger(mockLogger);
    const assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      subjectAttributes,
      'default-value',
    );
    expect(assignment).toEqual('variant-1');
  });

  it('only returns variation if subject matches rules', () => {
    td.replace(HybridConfigurationStore.prototype, 'get', (key: string) => {
      if (key !== obfuscatedFlagKey) {
        throw new Error('Unexpected key ' + key);
      }

      // Modified flag with a single rule.
      return {
        ...mockUfcFlagConfig,
        allocations: [
          {
            ...mockUfcFlagConfig.allocations[0],
            rules: [
              {
                conditions: [
                  {
                    attribute: md5('appVersion'),
                    operator: md5('GT'),
                    value: encode('10'),
                  },
                ],
              },
            ],
          },
        ],
      };
    });

    let assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      { appVersion: 9 },
      'default-value',
    );
    expect(assignment).toEqual('default-value');
    assignment = globalClient.getStringAssignment(flagKey, 'subject-10', {}, 'default-value');
    expect(assignment).toEqual('default-value');
    assignment = globalClient.getStringAssignment(
      flagKey,
      'subject-10',
      { appVersion: 11 },
      'default-value',
    );
    expect(assignment).toEqual('variant-1');
  });
});
