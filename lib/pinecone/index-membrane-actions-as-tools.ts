import { IntegrationAppClient } from '@integration-app/sdk';
import { Pinecone } from '@pinecone-database/pinecone';

import { config } from 'dotenv';
import { generateIntegrationAppAdminToken } from '../integration-app/generateAdminToken';
import type { ToolIndexItem } from '../types';

// Load environment variables from .env file
config({ path: '.env.local' });

async function fetchAllWithPagination<T>(
  fetchFn: (params: {
    cursor?: string;
  }) => Promise<{ items: T[]; cursor?: string }>,
): Promise<T[]> {
  const allItems: T[] = [];
  let cursor: string | undefined;

  do {
    const result = await fetchFn({ cursor });
    allItems.push(...result.items);
    cursor = result.cursor;
  } while (cursor);

  return allItems;
}

async function getAllWorkspaceActions() {
  const integrationAppClient = new IntegrationAppClient({
    token: generateIntegrationAppAdminToken(),
  });

  const allIntegrations = await fetchAllWithPagination(({ cursor }) =>
    integrationAppClient.integrations.find({ cursor }),
  );

  console.log(`\nWorkspace has ${allIntegrations.length} integrations\n`);

  const allActions: ToolIndexItem[] = [];

  for (const integration of allIntegrations) {
    const allActionsForIntegration = await fetchAllWithPagination(
      ({ cursor }) =>
        integrationAppClient.actions.find({
          integrationId: integration.id,
          cursor,
        }),
    );

    console.log(
      `Integration "${integration.name}" has ${allActionsForIntegration.length} actions`,
    );

    allActions.push(
      ...allActionsForIntegration.map((action) => {
        return {
          id: `${integration.key}_${action.key}`,
          integrationName: integration.key,
          toolKey: action.key,
          text: action.name,
        };
      }),
    );
  }

  return allActions;
}

async function upsertActionsToPinecone(actions: ToolIndexItem[]): Promise<any> {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not set');
  }

  if (!process.env.PINECONE_TOOLS_INDEX_NAME) {
    throw new Error('PINECONE_TOOLS_INDEX_NAME is not set');
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index(process.env.PINECONE_TOOLS_INDEX_NAME);

  // Upsert in batches to avoid rate limiting errors
  const BATCH_SIZE = 90;

  for (let i = 0; i < actions.length; i += BATCH_SIZE) {
    const batch = actions.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
        actions.length / BATCH_SIZE,
      )}`,
    );

    await index.upsertRecords(batch);
  }

  const stats = await index.describeIndexStats();
  return stats;
}

/**
 * Get all actions from the workspace and upsert them to Pinecone
 *
 * LLM generally do well when you have a few tools passed so with with,
 * so we are indexing all actions from the workspace to Pinecone so
 * that so can do a search on them and pass tools to the LLM based on the
 * search results.
 */
const main = async () => {
  const actions = await getAllWorkspaceActions();
  const stats = await upsertActionsToPinecone(actions);

  console.log('Successfully upserted actions to Pinecone');
  console.log(stats);
};

main();
