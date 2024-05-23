import { IAssignmentLogger } from '@eppo/js-client-sdk-common';

import { init } from './src/index';

const assignmentLogger: IAssignmentLogger = {
  logAssignment(assignment) {
    console.log('assignement', assignment);
  },
};

async function main() {
  const eppoClient = await init({
    apiKey: 'O8xGu8cegyGTWYq8Vc02QMmhez-fz8mjL4ajY247kro',
    assignmentLogger,
    vercelParams: {
      edgeConfig: 'https://edge-config.vercel.com/...',
      edgeConfigStoreId: '...',
      vercelApiToken: '...',
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
