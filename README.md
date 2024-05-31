# Eppo Javascript SDK for Vercel

[![Test and lint SDK](https://github.com/Eppo-exp/vercel-edge/actions/workflows/lint-test-sdk.yml/badge.svg)](https://github.com/Eppo-exp/vercel-edge/actions/workflows/lint-test-sdk.yml)
[![](https://data.jsdelivr.com/v1/package/npm/@eppo/vercel-edge/badge)](https://www.jsdelivr.com/package/npm/@eppo/vercel-edge)

[Eppo](https://www.geteppo.com/) is a modular flagging and experimentation analysis tool. Eppo's Javascript SDK is built to make assignments for single user client applications that run in a web browser. Before proceeding you'll need an Eppo account.

## Features

- Feature gates
- Kill switches
- Progressive rollouts
- A/B/n experiments
- Mutually exclusive experiments (Layers)
- Global holdouts
- Dynamic configuration

## Installation

```javascript
npm install @eppo/vercel-edge-sdk
```

## Quick start

This SDK is inteded to be used in [Vercel Edge Middleware](https://vercel.com/docs/functions/edge-middleware) and in [Vercel Function](https://vercel.com/docs/functions/quickstart) for hydration and keeping stored config up-to-date.

[Vercel Edge Config Store ](https://vercel.com/docs/storage/edge-config/using-edge-config) is required for storing Eppo configs.

#### Example of usage in middleware.ts file

```javascript
import { NextResponse, NextRequest } from 'next/server';

import { init } from './services/eppo-client';
import { IAssignmentLogger } from '@eppo/js-client-sdk-common';

const assignmentLogger: IAssignmentLogger = {
  logAssignment(assignment) {
    console.log('assignement', assignment)
  },
};

export async function middleware(request: NextRequest) {
  try {
    if (!process.env.EDGE_CONFIG) {
      throw new Error('Define EDGE_CONFIG env variable');
    }

    if (!process.env.EDGE_CONFIG_STORE_ID) {
      throw new Error('Define EDGE_CONFIG_STORE_ID env variable')
    }

    if (!process.env.EDGE_CONFIG_TOKEN) {
      throw new Error('Define EDGE_CONFIG_TOKEN env variable')
    }

    if (!process.env.INTERNAL_FEATURE_FLAG_API_KEY) {
      throw new Error('Define INTERNAL_FEATURE_FLAG_API_KEY env variable')
    }

    const user = getCurrentUser();

    const eppoClient = await init({
      apiKey: process.env.INTERNAL_FEATURE_FLAG_API_KEY,
      assignmentLogger,
      vercelParams: {
        edgeConfig: process.env.EDGE_CONFIG,
        edgeConfigStoreId: process.env.EDGE_CONFIG_STORE_ID,
        vercelApiToken: process.env.EDGE_CONFIG_TOKEN,
        vercelFunctionUrl: process.env.VERCEL_FUNCTION_URL // e.g. https://domain/api/eppo-prefetch
        edgeConfigExpirationSeconds: 1000,
      }
    });

    const variation = eppoClient.getBooleanAssignment('show-new-feature', user.id, { 
      'country': user.country,
      'device': user.device,
    }, false);

    console.log('show-new-feature enabled:', variation);

    return NextResponse.next();
  } catch (error) {
    console.error('Error in middleware:', error);
    
    // Return an error response if needed
    return NextResponse.error();
  }
}

// Define paths where middleware should run
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.js$|.*\\.css$|.*\\.map$|.*\\.json$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)',
  ],
};

```

This script will not fetch configs from Eppo, only from Vercel Config Store.

To fetch configs from Eppo and store them in Vercel Config Store, you need to create a Vercel Function.

Example:

`pages/api/eppo-prefetch.ts`

```ts
export const runtime = 'nodejs';

import { IAssignmentLogger, prefetchConfig } from '@eppo/vercel-edge-sdk';
import { NextApiRequest, NextApiResponse } from 'next';

const assignmentLogger: IAssignmentLogger = {
  logAssignment(assignment) {
    console.log('assignement', assignment)
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  try {
    if (!process.env.EDGE_CONFIG) {
      throw new Error('Define EDGE_CONFIG env variable');
    }

    if (!process.env.EDGE_CONFIG_STORE_ID) {
      throw new Error('Define EDGE_CONFIG_STORE_ID env variable')
    }

    if (!process.env.EDGE_CONFIG_TOKEN) {
      throw new Error('Define EDGE_CONFIG_TOKEN env variable')
    }

    if (!process.env.INTERNAL_FEATURE_FLAG_API_KEY) {
      throw new Error('Define INTERNAL_FEATURE_FLAG_API_KEY env variable')
    }

    prefetchConfig({
      apiKey: process.env.INTERNAL_FEATURE_FLAG_API_KEY,
        assignmentLogger,
        vercelParams: {
          edgeConfig: process.env.EDGE_CONFIG,
          edgeConfigStoreId: process.env.EDGE_CONFIG_STORE_ID,
          vercelApiToken: process.env.VERCEL_API_TOKEN,
        },
    });

    res.status(200).json({ message: 'Prefetch success' });
  } catch(e) {
    res.status(500).json({ message: 'Prefetch error'});
  }
}
```

Your middleware, each time running, will start this cloud function (by doing an async request to the url specidifed in `vercelParams.vercelFunctionUrl`), and it will fetch and store configs.

The flow is next:
- if config stored in Vercel Config Store is not outdated, middleware will give return up-to-date assignment;
- if config stored in Vercel Config Store is outdated, middleware will still give an assignment requested, just outdated, and send a request to start Vercel Function to prefetch up-to-date config; Next run of the middleware will give an updated result;


### Vercel Cron Job

You can hydrate data using [Vercel Cron Job](https://vercel.com/guides/how-to-setup-cron-jobs-on-vercel).
For this, in your middleware, do not provide a URL to Vercel Function.
Create a Vercel Function and as in the example above, and create a cron job like:

```ts
{
  "crons": [
    {
      "path": "/api/eppo-prefetch",
      "schedule": "0 5 * * *"
    }
  ]
}
```

## Assignment functions

Every Eppo flag has a return type that is set once on creation in the dashboard. Once a flag is created, assignments in code should be made using the corresponding typed function: 

```javascript
getBoolAssignment(...)
getNumericAssignment(...)
getIntegerAssignment(...)
getStringAssignment(...)
getJSONAssignment(...)
```

Each function has the same signature, but returns the type in the function name. For booleans use `getBooleanAssignment`, which has the following signature:

```javascript
getBooleanAssignment: (
  flagKey: string,
  subjectKey: string,
  subjectAttributes: Record<string, any>,
  defaultValue: string,
) => boolean
  ```

## Initialization options

The `init` function accepts the following optional configuration arguments.

| Option | Type | Description | Default |
| ------ | ----- | ----- | ----- | 
| **`assignmentLogger`**  | [IAssignmentLogger](https://github.com/Eppo-exp/js-client-sdk-common/blob/75c2ea1d91101d579138d07d46fca4c6ea4aafaf/src/assignment-logger.ts#L55-L62) | A callback that sends each assignment to your data warehouse. Required only for experiment analysis. See [example](#assignment-logger) below. | `null` |
| **`requestTimeoutMs`** | number | Timeout in milliseconds for HTTPS requests for the experiment configurations. | `5000` |
| **`numInitialRequestRetries`** | number | Number of _additional_ times the initial configurations request will be attempted if it fails. This is the request typically synchronously waited (via `await`) for completion. A small wait will be done between requests. | `1` |
| **`pollAfterSuccessfulInitialization`** | boolean | Poll for new configurations (every 30 seconds) after successfully requesting the initial configurations. | `false` |
| **`pollAfterFailedInitialization`** | boolean | Poll for new configurations even if the initial configurations request failed. | `false` |
| **`throwOnFailedInitialization`** | boolean | Throw an error (reject the promise) if unable to fetch initial configurations during initialization. | `true` |
| **`numPollRequestRetries`** | number | If polling for updated configurations after initialization, the number of additional times a request will be attempted before giving up. Subsequent attempts are done using an exponential backoff. | `7` |



## Assignment logger 

To use the Eppo SDK for experiments that require analysis, pass in a callback logging function to the `init` function on SDK initialization. The SDK invokes the callback to capture assignment data whenever a variation is assigned. The assignment data is needed in the warehouse to perform analysis.

The code below illustrates an example implementation of a logging callback using [Segment](https://segment.com/), but you can use any system you'd like. The only requirement is that the SDK receives a `logAssignment` callback function. Here we define an implementation of the Eppo `IAssignmentLogger` interface containing a single function named `logAssignment`:

```javascript
import { IAssignmentLogger } from "@eppo/vercel-edge-sdk";
import { AnalyticsBrowser } from "@segment/analytics-next";

// Connect to Segment (or your own event-tracking system)
const analytics = AnalyticsBrowser.load({ writeKey: "<SEGMENT_WRITE_KEY>" });

const assignmentLogger: IAssignmentLogger = {
  logAssignment(assignment) {
    analytics.track({
      userId: assignment.subject,
      event: "Eppo Randomized Assignment",
      type: "track",
      properties: { ...assignment },
    });
  },
};
```

## Philosophy

Eppo's SDKs are built for simplicity, speed and reliability. Flag configurations are compressed and distributed over a global CDN (Fastly), typically reaching end users in under 15ms. Those configurations are then cached locally, ensuring that each assignment is made instantly. Each SDK is as light as possible, with evaluation logic at around [25 simple lines of code](https://github.com/Eppo-exp/js-client-sdk-common/blob/b903bbbca21ca75c0ab49d894951eb2f1fc6c85b/src/evaluator.ts#L34-L59). The simple typed functions listed above are all developers need to know about, abstracting away the complexity of the underlying set of features. 

## React

Visit the [Eppo docs](https://docs.geteppo.com/sdks/client-sdks/javascript#usage-in-react) for best practices when using this SDK within a React context.



