import {
  IAssignmentLogger,
  validation,
  IEppoClient,
  EppoClient,
  FlagConfigurationRequestParameters,
  MemoryOnlyConfigurationStore,
  Flag,
  HybridConfigurationStore,
  MemoryStore,
} from '@eppo/js-client-sdk-common';

import { sdkName, sdkVersion } from './sdk-data';
import VercelAsyncStore from './vercel-async-store';

export {
  IAssignmentLogger,
  IAssignmentEvent,
  IEppoClient,
  IAsyncStore,
} from '@eppo/js-client-sdk-common';

/**
 * Configuration used for initializing the Eppo client
 * @public
 */
export interface IClientConfig {
  /**
   * Eppo API key
   */
  apiKey: string;

  /**
   * Params for setting up connection with Vercel
   *
   * edgeConfig - string given on creation of Vercel Edge Config Store.
   * edgeConfigStoreId - id of created Vercel Edge Config Store.
   * vercelApiToken - Vercel API token with write access. Needed to write configs to Vercel Edge Config Store.
   * edgeConfigExpirationSeconds - Time during which config, stored in vercel, is valid. Defaults to 30 seconds
   */
  vercelParams: {
    edgeConfig: string;
    edgeConfigStoreId: string;
    vercelApiToken: string;
    edgeConfigExpirationSeconds?: number;
    vercelFunctionUrl?: string;
  };

  /**
   * Base URL of the Eppo API.
   * Clients should use the default setting in most cases.
   */
  baseUrl?: string;

  /**
   * Pass a logging implementation to send variation assignments to your data warehouse.
   */
  assignmentLogger: IAssignmentLogger;

  /***
   * Timeout in milliseconds for the HTTPS request for the experiment configuration. (Default: 5000)
   */
  requestTimeoutMs?: number;

  /**
   * Number of additional times the initial configuration request will be attempted if it fails.
   * This is the request typically synchronously waited (via await) for completion. A small wait will be
   * done between requests. (Default: 1)
   */
  numInitialRequestRetries?: number;

  /**
   * Throw an error if unable to fetch an initial configuration during initialization. (default: true)
   */
  throwOnFailedInitialization?: boolean;
}

/**
 * Client for assigning experiment variations.
 * @public
 */
export class EppoJSClient extends EppoClient {
  // Ensure that the client is instantiated during class loading.
  // Use an empty memory-only configuration store until the `init` method is called,
  // to avoid serving stale data to the user.
  public static instance: EppoJSClient = new EppoJSClient(
    new MemoryOnlyConfigurationStore(),
    undefined,
    true,
  );
  public static initialized = false;

  public getStringAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, string | number | boolean>,
    defaultValue: string,
  ): string {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getStringAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getBoolAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, string | number | boolean>,
    defaultValue: boolean,
  ): boolean {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getBoolAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getIntegerAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, string | number | boolean>,
    defaultValue: number,
  ): number {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getIntegerAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getNumericAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, string | number | boolean>,
    defaultValue: number,
  ): number {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getNumericAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  public getJSONAssignment(
    flagKey: string,
    subjectKey: string,
    subjectAttributes: Record<string, string | number | boolean>,
    defaultValue: object,
  ): object {
    EppoJSClient.getAssignmentInitializationCheck();
    return super.getJSONAssignment(flagKey, subjectKey, subjectAttributes, defaultValue);
  }

  private static getAssignmentInitializationCheck() {
    if (!EppoJSClient.initialized) {
      console.warn('Eppo SDK assignment requested before init() completed');
    }
  }
}

/**
 * Initializes the Eppo client with configuration parameters.
 * This method should be called once on application startup.
 * @param config - client configuration
 * @public
 */
export async function init(config: IClientConfig): Promise<IEppoClient> {
  await initClient(config);
  EppoJSClient.initialized = true;
  return EppoJSClient.instance;
}

async function initClient(config: IClientConfig) {
  validateConfig(config);
  try {
    // If any existing instances; ensure they are not polling
    if (EppoJSClient.instance) {
      EppoJSClient.instance.stopPolling();
    }

    const configurationStore = new HybridConfigurationStore(
      new MemoryStore<Flag>(),
      new VercelAsyncStore<Flag>(
        config.vercelParams.edgeConfig,
        config.vercelParams.edgeConfigStoreId,
        config.vercelParams.vercelApiToken,
        config.vercelParams.edgeConfigExpirationSeconds,
      ),
    );

    await configurationStore.init();
    EppoJSClient.instance.setConfigurationStore(configurationStore);
    EppoJSClient.instance.useNonExpiringInMemoryAssignmentCache();

    const requestConfiguration: FlagConfigurationRequestParameters = {
      apiKey: config.apiKey,
      sdkName,
      sdkVersion,
      baseUrl: config.baseUrl ?? undefined,
      requestTimeoutMs: config.requestTimeoutMs ?? undefined,
      numInitialRequestRetries: config.numInitialRequestRetries ?? undefined,
      pollAfterSuccessfulInitialization: false,
      pollAfterFailedInitialization: false,
      throwOnFailedInitialization: true, // always use true here as underlying instance fetch is surrounded by try/catch
      skipInitialPoll: false,
    };

    EppoJSClient.instance.setLogger(config.assignmentLogger);
    EppoJSClient.instance.setConfigurationRequestParameters(requestConfiguration);

    if (config.vercelParams.vercelFunctionUrl) {
      fetch(config.vercelParams.vercelFunctionUrl);
    }
  } catch (error) {
    console.warn(
      'Eppo SDK encountered an error initializing, assignment calls will return the default value and not be logged',
    );
    if (config.throwOnFailedInitialization ?? true) {
      throw error;
    }
  }
}

export async function prefetchConfig(config: IClientConfig) {
  await initClient(config);

  await EppoJSClient.instance.fetchFlagConfigurations();
}

function validateConfig(config: IClientConfig) {
  validation.validateNotBlank(config.apiKey, 'API key required');
  validation.validateNotBlank(config.vercelParams.edgeConfig, 'EDGE_CONFIG is required');
  validation.validateNotBlank(config.vercelParams.vercelApiToken, 'Vercel api token is required');
  validation.validateNotBlank(
    config.vercelParams.edgeConfigStoreId,
    'Edge Config Store Id is required',
  );
}

/**
 * Used to access a singleton SDK client instance.
 * Use the method after calling init() to initialize the client.
 * @returns a singleton client instance
 * @public
 */
export function getInstance(): IEppoClient {
  return EppoJSClient.instance;
}
