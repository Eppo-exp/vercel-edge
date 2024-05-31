import { IAssignmentLogger } from '@eppo/js-client-sdk-common';

import { init, prefetchConfig } from './src/index';

const assignmentLogger: IAssignmentLogger = {
  logAssignment(assignment) {
    console.log('assignement', assignment);
  },
};

async function main() {
  await prefetchConfig({
    apiKey: '...',
    assignmentLogger,
    vercelParams: {
      edgeConfig: 'https://edge-config.vercel.com/...',
      edgeConfigStoreId: '...',
      vercelApiToken: '..',
    },
  });

  const eppoClient = await init({
    apiKey: '...',
    assignmentLogger,
    vercelParams: {
      edgeConfig: 'https://edge-config.vercel.com/...',
      edgeConfigStoreId: '...',
      vercelApiToken: '...',
      vercelFunctionUrl: 'http://localhost:3001/api/eppo-prefetch',
    },
  });

  const isEnabled = eppoClient.getBoolAssignment(
    'bool-flag',
    '6',
    {
      userId: 6,
      companyId: 1,
      email: 'pavel@fluxon.com',
      environment: 'Production',
    },
    false,
  );

  console.log('bool-flag enabled:', isEnabled);
}

main();
