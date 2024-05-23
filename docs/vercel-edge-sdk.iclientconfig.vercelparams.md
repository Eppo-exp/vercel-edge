<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@eppo/vercel-edge-sdk](./vercel-edge-sdk.md) &gt; [IClientConfig](./vercel-edge-sdk.iclientconfig.md) &gt; [vercelParams](./vercel-edge-sdk.iclientconfig.vercelparams.md)

## IClientConfig.vercelParams property

Params for setting up connection with Vercel

edgeConfig - string given on creation of Vercel Edge Config Store. edgeConfigStoreId - id of created Vercel Edge Config Store. vercelApiToken - Vercel API token with write access. Needed to write configs to Vercel Edge Config Store.

**Signature:**

```typescript
vercelParams: {
        edgeConfig: string;
        edgeConfigStoreId: string;
        vercelApiToken: string;
    };
```