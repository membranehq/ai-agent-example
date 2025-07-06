import { generateIntegrationAppCustomerAccessToken } from '@/lib/integration-app/generateCustomerAccessToken';
import { getToolsFromMCP } from '@/lib/integration-app/mcp';
import type { ToolIndexItem } from '@/lib/types';
import { Pinecone } from '@pinecone-database/pinecone';

interface HandleConnectProps {
  user: {
    id: string;
    name: string;
  };
  app?: string;
}

export async function indexMcpTools({ user, app }: HandleConnectProps) {
  const INDEX_NAME = process.env.PINECONE_CLIENT_TOOLS as string;

  const token = await generateIntegrationAppCustomerAccessToken({
    id: user.id,
    name: user.name,
  });

  if (app) {
    console.log('Getting tools for connected app', {
      app,
    });
  } else {
    console.log('Getting tools for all apps');
  }

  // get tools for the app that was connected from MCP
  const { tools: toolsForConnectedApp, mcpClient } = await getToolsFromMCP({
    token,
    app,
  });

  await mcpClient.close();

  console.log(`We got ${Object.keys(toolsForConnectedApp).length} tools`);

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY as string,
  });

  const index = pinecone.Index(INDEX_NAME);

  const records: (ToolIndexItem & { userId: string })[] = [];

  /////////////////
  // INDEX TOOLS //
  //////////////////
  for (const toolKey in toolsForConnectedApp) {
    const tool = toolsForConnectedApp[toolKey];

    /**
     * The MCP server puts the integration key at the start of the tool name
     * e.g "notion_get-all-databases"
     *
     *
     *  "notion_get-all-databases" ==> "notion"
     */
    const integrationKey = toolKey.split('_')[0];

    const record = {
      id: `${integrationKey}_${toolKey}`,
      toolKey: toolKey,
      text: tool.description as string,
      integrationKey: integrationKey.toLowerCase(),
      userId: user.id,
    };

    records.push(record);
  }

  // Upsert in batches to avoid rate limiting errors
  const BATCH_SIZE = 90;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
        records.length / BATCH_SIZE,
      )}`,
    );

    console.log('Storing tools in Pinecone', {
      index: INDEX_NAME,
      namespace: user.id,
    });

    // use a namespace per user
    await index.namespace(user.id).upsertRecords(batch);
  }
}
